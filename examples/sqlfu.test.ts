import dedent from 'dedent'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const sqlfuPackageRoot = '/Users/mmkal/src/sqlfu/packages/sqlfu'

test('sqlfu demo', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())
  computer.on('step:start', ({ title }) => {
    void computer.exec`say ${title}`.catch(() => {})
  })

  await computer.writeJsonFile('package.json', {
    type: 'module',
    devDependencies: {
      '@types/node': '24.5.2',
      typescript: '5.9.3',
    },
  })
  await computer.writeJsonFile('tsconfig.json', {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      strict: true,
      target: 'ES2022',
      types: ['node'],
    },
    include: ['posts-object.ts'],
  })
  await computer.exec`mkdir -p .vscode`
  await computer.writeJsonFile('.vscode/settings.json', {
    'terminal.integrated.env.osx': {
      PATH: '${workspaceFolder}/node_modules/.bin:${env:PATH}',
    },
    "cursor.cpp.disableAutoComplete": true,
    "editor.inlineSuggest.enabled": false,
    'editor.autoClosingBrackets': 'never',
    'editor.autoClosingQuotes': 'never',
    'editor.autoIndent': 'none',
    'editor.codeActionsOnSave': {},
    'editor.formatOnSave': false,
    'files.autoSave': 'off',
    // 'workbench.panel.defaultLocation': 'right',
  })
  await computer.exec({ timeout: 120_000 })`pnpm install ${sqlfuPackageRoot}`
  await computer.writeFile('posts-object.ts', '')

  expect(await computer.glob('node_modules/sqlfu/package.json')).toHaveLength(1)
  expect(await computer.permissions()).toMatchObject({
    permissions: expect.objectContaining({
      isGranted: true,
      name: 'Accessibility',
    }),
  })

  await using ide = await computer.open('.', {
    app: 'Cursor',
    waitUntilReady: true,
  })

  await ide.hotkey('cmd,k')
  await ide.hotkey('cmd,w')

  await computer.open('posts-object.ts', {
    app: 'Cursor',
    waitUntilReady: true,
  })

  await ide.click(ide.center())

  await computer.step('write the initial source file', async () => {
    await ide.type(postsObjectSource, {delay: -1})
    await ide.hotkey('cmd,s')

    await computer.waitForFile('posts-object.ts', {
      contains: 'static dbConfig = defineConfig',
    })
  })

  await using video = await ide.startVideo()

  await computer.step('generate query types', async () => {
    await ide.ocr('listPosts: sql').highlight();
    await ide.sleep(600);

    await ide.hotkey('ctrl,`')
    await ide.sleep(150)
    await ide.type('sqlfu --config posts-object.ts generate --watch')
    await ide.press('return', { noAutoFocus: true })

    await computer.waitForFile('posts-object.ts', {
      contains: /listPosts: sql.many<{.+}>/,
    })

    await ide.ocr('sql.many').click('start')
    await ide.hotkey('cmd+shift+right', { linger: 1000 })
  })

  await computer.step('update the query - types are updated automatically', async () => {
    await ide.ocr('from posts').append(' limit :limit')

    await ide.hotkey('cmd,s')

    await computer.waitForFile('posts-object.ts', {
      contains: /listPosts: sql.many<{.*limit.*}>/,
    })

    await ide.ocr('sql.many').click('start')
    await ide.hotkey('cmd+shift+right', { linger: 1000 })
  })

  await computer.step('use the query', async () => {
    await ide.hotkey('cmd,down')

    const migrateText = ide.ocr('this.db.migrate')
    await migrateText.click('end')
    await ide.press('down')

    const badMethod = dedent`
      async getPosts() {
        return this.db.listPosts({ limitttt: 10 })
      }
    `
    await ide.type('\n\n' + badMethod, {indent: 2})
    await ide.press('escape')
  })

  await computer.step('fix T.S.C errors - query is strongly-typed', async () => {
    const limitt = await ide.ocr('limitttt').hover({ linger: 1000 })
    await limitt.replace('limit')

    await ide.hotkey('cmd,s')
    await ide.sleep(500)
  })

  await computer.step('add a migration', async () => {
    await ide.hotkey('cmd,up') // jump to top
    await ide.ocr('migrations').highlight({ linger: 600 });

    await ide.hotkey('ctrl,`')
    await ide.hotkey('ctrl,c')

    await ide.type(`sqlfu --config posts-object.ts draft\n`)
    await ide.sleep(500)
    await ide.press('return')

    await ide.sleep(500)
  })

  await computer.step('edit definitions and add another migration', async () => {
    await ide
      .ocr('body text', { before: 'migrations:' })
      .append(',\n        published_at date')
    await ide.hotkey('cmd,s')

    await ide.hotkey('ctrl,`')
    await ide.type(`sqlfu --config posts-object.ts draft\n`)
    await ide.sleep(500)
    await ide.press('return')
    await ide.hotkey('cmd,1')
    await ide.scroll({ direction: 'down', amount: 3, smooth: true })

    await ide.ocr('alter table', {before: 'queries'}).click('start');
    await ide.hotkey('cmd+shift+right', { linger: 1000 })
  })

  await video.save()
}, 240_000)

const postsObjectSource = dedent`
  import {createDurableObjectClient, defineConfig, sql} from 'sqlfu';

  export class PostsObject {
    static dbConfig = defineConfig({
      definitions: sql\`
        create table posts (
          slug text primary key not null,
          title text not null,
          body text
        );
      \`,
      migrations: [],
      queries: {
        listPosts: sql\`
          select slug, title from posts
        \`,
      },
    });

    db: ReturnType<typeof PostsObject.dbConfig<ReturnType<typeof createDurableObjectClient>>>;

    constructor(ctx: any) {
      this.db = PostsObject.dbConfig(createDurableObjectClient(ctx.storage));
      this.db.migrate();
    }
  }
`
