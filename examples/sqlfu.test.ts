import dedent from 'dedent'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const sqlfuPackageRoot = '/Users/mmkal/src/sqlfu/packages/sqlfu'

test('sqlfu demo', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

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

  await ide.hotkey('cmd,1')
  await ide.click(ide.center())

  await using video = await ide.startVideo()

  await ide.type(postsObjectSource, {
    delay: -1,
    noAutoFocus: true,
    profile: 'linear',
  })
  await ide.hotkey('cmd,s')
  await ide.scroll({ amount: 1, direction: 'down', smooth: true })

  await computer.waitForFile('posts-object.ts', {
    contains: 'static dbConfig = defineConfig',
    timeout: 30_000,
  })

  await ide.ocr({ text: 'listPosts: sql' }).highlight();
  await ide.sleep(600);

  await ide.hotkey('ctrl,`')
  await ide.sleep(150)
  await ide.type('sqlfu --config posts-object.ts generate --watch')
  await ide.press('return', { noAutoFocus: true })

  await computer.waitForFile('posts-object.ts', {
    contains: /listPosts: sql.many<{.+}>/,
  })

  const fromPosts = ide.ocr({ text: 'from posts' })
  await fromPosts.click('end')
  await ide.type(' limit :limit')

  await ide.hotkey('cmd,s')

  await computer.waitForFile('posts-object.ts', {
    contains: /listPosts: sql.many<{.*limit.*}>/,
  })

  await ide.hotkey('cmd,down')

  const migrateText = ide.ocr({ text: 'this.db.migrate' })
  await migrateText.click('end')
  await ide.press('down')

  const badMethod = dedent`
    async getPosts() {
      return this.db.listPosts({ limitttt: 10 })
    }
  `
  await ide.type('\n\n' + badMethod, {indent: 2})
  await ide.press('escape')

  const limitt = ide.ocr({ text: 'limitt' })
  await limitt.hover();
  await ide.sleep(1000);
  await limitt.dblclick();

  await ide.type('limit', {delay: 10, noAutoFocus: true, profile: 'linear'})

  await ide.hotkey('cmd,s')

  await ide.sleep(500)

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
