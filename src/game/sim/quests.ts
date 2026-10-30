import {
  QUEST_IDS,
  type QuestId,
  type QuestState,
  type QuestTrigger,
  questTuning,
} from "../tuning/quests";

export type { QuestId, QuestState };
export { QUEST_IDS };

/** How far one Quest has got, and how many of its parts are done. */
export type QuestProgress = {
  state: QuestState;
  /** Parts done of a Quest that asks for several; 0 for the others. */
  count: number;
};

/** Every Quest's progress, kept by the Save. */
export type QuestLog = Record<QuestId, QuestProgress>;

/** Something the Hero did that a Quest may be asking for. */
export type QuestTask =
  | { type: "talked"; npc: string }
  | { type: "boneAltarDestroyed"; area: string }
  | { type: "uniqueKilled"; area: string }
  | { type: "actBossKilled"; act: number };

/** A log with every Quest Not given. */
export function freshQuests(): QuestLog {
  return Object.fromEntries(
    QUEST_IDS.map((id) => [id, { state: "notGiven", count: 0 }]),
  ) as QuestLog;
}

/** A copy of `log` sharing nothing with it. */
export function copyQuests(log: QuestLog): QuestLog {
  return Object.fromEntries(
    QUEST_IDS.map((id) => [id, { ...log[id] }]),
  ) as QuestLog;
}

/** How many parts `trigger` asks for. */
export function partsOf(trigger: QuestTrigger): number {
  return trigger.type === "boneAltars" ? trigger.count : 1;
}

/** Whether `task` is a part of what `trigger` asks for. */
function counts(trigger: QuestTrigger, task: QuestTask): boolean {
  switch (trigger.type) {
    case "talk":
      return task.type === "talked" && task.npc === trigger.npc;
    case "boneAltars":
      return task.type === "boneAltarDestroyed" && task.area === trigger.area;
    case "uniqueKilled":
      return task.type === "uniqueKilled" && task.area === trigger.area;
    case "actBossKilled":
      return task.type === "actBossKilled" && task.act === trigger.act;
  }
}

/**
 * What `task` did to the Quest `id` in `log`: counted towards it, or made it
 * Ready to hand in from Not given or Given; nothing for a Quest already
 * Ready or Done, or one that doesn't ask for it.
 */
export function advanceQuest(
  log: QuestLog,
  id: QuestId,
  task: QuestTask,
): "counted" | "ready" | null {
  const quest = log[id];
  const { trigger } = questTuning[id];
  if (quest.state === "ready" || quest.state === "done") return null;
  if (!counts(trigger, task)) return null;
  quest.count = Math.min(quest.count + 1, partsOf(trigger));
  if (quest.count < partsOf(trigger)) return "counted";
  quest.state = "ready";
  return "ready";
}

/** The Quests the NPC called `npc` gives, in the Quest panel's order. */
export function questsOf(npc: string): QuestId[] {
  return QUEST_IDS.filter((id) => questTuning[id].giver === npc);
}

/** Whether the NPC called `npc` has a Quest to give or to take back. */
export function hasQuestToDealIn(log: QuestLog, npc: string): boolean {
  return questsOf(npc).some(
    (id) => log[id].state === "notGiven" || log[id].state === "ready",
  );
}

/**
 * The points the Done Quests gave: the Attribute Points and Skill Points
 * that no Level granted.
 */
export function questPointsOf(log: QuestLog): {
  attributePoints: number;
  skillPoints: number;
} {
  let attributePoints = 0;
  let skillPoints = 0;
  for (const id of QUEST_IDS) {
    if (log[id].state !== "done") continue;
    const { reward } = questTuning[id];
    if (reward.type === "attributePoints") attributePoints += reward.amount;
    if (reward.type === "skillPoints") skillPoints += reward.amount;
  }
  return { attributePoints, skillPoints };
}
