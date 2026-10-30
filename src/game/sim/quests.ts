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
export type QuestStates = Record<QuestId, QuestProgress>;

/** Something the Hero did that a Quest may be asking for. */
export type QuestDeed =
  | { type: "talked"; npc: string }
  | { type: "boneAltarDestroyed"; area: string }
  | { type: "uniqueKilled"; area: string }
  | { type: "actBossKilled"; act: number };

/** A states with every Quest Not given. */
export function freshQuests(): QuestStates {
  return Object.fromEntries(
    QUEST_IDS.map((id) => [id, { state: "notGiven", count: 0 }]),
  ) as QuestStates;
}

/** A copy of `states` sharing nothing with it. */
export function copyQuests(states: QuestStates): QuestStates {
  return Object.fromEntries(
    QUEST_IDS.map((id) => [id, { ...states[id] }]),
  ) as QuestStates;
}

/** How many parts `trigger` asks for. */
export function questPartsOf(trigger: QuestTrigger): number {
  return trigger.type === "boneAltars" ? trigger.count : 1;
}

/** Whether `deed` is a part of what `trigger` asks for. */
function deedCounts(trigger: QuestTrigger, deed: QuestDeed): boolean {
  switch (trigger.type) {
    case "talk":
      return deed.type === "talked" && deed.npc === trigger.npc;
    case "boneAltars":
      return deed.type === "boneAltarDestroyed" && deed.area === trigger.area;
    case "uniqueKilled":
      return deed.type === "uniqueKilled" && deed.area === trigger.area;
    case "actBossKilled":
      return deed.type === "actBossKilled" && deed.act === trigger.act;
  }
}

/**
 * What `deed` did to the Quest `id` in `states`: counted towards it, or made it
 * Ready to hand in from Not given or Given; nothing for a Quest already
 * Ready or Done, or one that doesn't ask for it.
 */
export function advanceQuest(
  states: QuestStates,
  id: QuestId,
  deed: QuestDeed,
): "counted" | "ready" | null {
  const quest = states[id];
  const { trigger } = questTuning[id];
  if (quest.state === "ready" || quest.state === "done") return null;
  if (!deedCounts(trigger, deed)) return null;
  quest.count = Math.min(quest.count + 1, questPartsOf(trigger));
  if (quest.count < questPartsOf(trigger)) return "counted";
  quest.state = "ready";
  return "ready";
}

/** The Quests the NPC called `npc` gives, in the Quest panel's order. */
export function questsOf(npc: string): QuestId[] {
  return QUEST_IDS.filter((id) => questTuning[id].giver === npc);
}

/** Whether the NPC called `npc` has a Quest to give or to take back. */
export function hasQuestBusiness(states: QuestStates, npc: string): boolean {
  return questsOf(npc).some(
    (id) => states[id].state === "notGiven" || states[id].state === "ready",
  );
}

/**
 * The points the Done Quests gave: the Attribute Points and Skill Points
 * that no Level granted.
 */
export function questPointsOf(states: QuestStates): {
  attributePoints: number;
  skillPoints: number;
} {
  let attributePoints = 0;
  let skillPoints = 0;
  for (const id of QUEST_IDS) {
    if (states[id].state !== "done") continue;
    const { reward } = questTuning[id];
    if (reward.type === "attributePoints") attributePoints += reward.amount;
    if (reward.type === "skillPoints") skillPoints += reward.amount;
  }
  return { attributePoints, skillPoints };
}
