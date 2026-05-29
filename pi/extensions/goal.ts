import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type GoalStatus = "active" | "complete" | "blocked" | "cleared";

interface GoalState {
	objective: string;
	status: GoalStatus;
	reason?: string;
	updatedAt: number;
}

interface GoalEntry {
	action: "set" | "update" | "clear";
	objective?: string;
	status: GoalStatus;
	reason?: string;
	updatedAt: number;
}

const UpdateGoalParams = Type.Object({
	status: StringEnum(["complete", "blocked"] as const),
	reason: Type.Optional(Type.String({ description: "Brief evidence for completion, or the blocker that prevents progress" })),
});

const CUSTOM_TYPE = "goal-state";

export default function (pi: ExtensionAPI) {
	let goal: GoalState | undefined;

	const setGoal = (entry: GoalEntry) => {
		if (entry.action === "clear" || entry.status === "cleared") {
			goal = undefined;
			return;
		}

		if (entry.action === "set") {
			if (!entry.objective) return;
			goal = {
				objective: entry.objective,
				status: "active",
				reason: entry.reason,
				updatedAt: entry.updatedAt,
			};
			return;
		}

		if (!goal) return;
		goal = {
			...goal,
			status: entry.status,
			reason: entry.reason,
			updatedAt: entry.updatedAt,
		};
	};

	const reconstructGoal = (ctx: ExtensionContext) => {
		goal = undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue;
			setGoal(entry.data as GoalEntry);
		}
	};

	const appendGoalEntry = (entry: GoalEntry) => {
		pi.appendEntry(CUSTOM_TYPE, entry);
		setGoal(entry);
	};

	pi.on("session_start", async (_event, ctx) => reconstructGoal(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructGoal(ctx));

	pi.on("before_agent_start", async (_event, _ctx) => {
		if (!goal || goal.status !== "active") return;

		return {
			systemPrompt: `${_event.systemPrompt}\n\n<active_goal>\nObjective: ${goal.objective}\n\nThis goal persists across turns. Keep working toward the full objective until it is actually complete or genuinely blocked. Do not redefine success around a smaller task. Before marking the goal complete, verify the current state against the objective. If the objective is complete, call update_goal with status \"complete\" and concise evidence. If meaningful progress is impossible without user input or an external state change, call update_goal with status \"blocked\" and explain the blocker.\n</active_goal>`,
		};
	});

	pi.registerCommand("goal", {
		description: "Set or show the persistent session goal",
		handler: async (args, ctx) => {
			const input = args.trim();

			if (!input) {
				if (!goal) {
					ctx.ui.notify("No active goal", "info");
					return;
				}
				ctx.ui.notify(`${goal.status}: ${goal.objective}${goal.reason ? ` (${goal.reason})` : ""}`, "info");
				return;
			}

			if (input === "clear") {
				appendGoalEntry({ action: "clear", status: "cleared", updatedAt: Date.now() });
				ctx.ui.notify("Goal cleared", "info");
				return;
			}

			appendGoalEntry({ action: "set", objective: input, status: "active", updatedAt: Date.now() });
			pi.setSessionName(input);
			ctx.ui.notify(`Goal set: ${input}`, "info");
			pi.sendUserMessage(`Pursue this goal until it is complete: ${input}`);
		},
	});

	pi.registerTool({
		name: "update_goal",
		label: "Update Goal",
		description: "Mark the active /goal objective complete or blocked.",
		promptSnippet: "Mark the active /goal objective complete or blocked when justified.",
		promptGuidelines: [
			"Use update_goal only when the active /goal objective is actually complete or genuinely blocked.",
			"Do not use update_goal to pause, narrow, or partially complete a goal.",
		],
		parameters: UpdateGoalParams,
		async execute(_toolCallId, params) {
			if (!goal || goal.status !== "active") {
				return {
					content: [{ type: "text", text: "No active goal to update." }],
					details: { error: "no-active-goal" },
				};
			}

			appendGoalEntry({
				action: "update",
				status: params.status,
				reason: params.reason,
				updatedAt: Date.now(),
			});

			return {
				content: [{ type: "text", text: `Goal marked ${params.status}${params.reason ? `: ${params.reason}` : "."}` }],
				details: { objective: goal.objective, status: params.status, reason: params.reason },
			};
		},
	});
}
