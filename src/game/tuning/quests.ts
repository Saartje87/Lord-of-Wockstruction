/** The Quests, as data: who gives them, what they ask, what they pay and what is said. */

/** The id of each Quest, in the order the Quest panel lists them. */
export const QUEST_IDS = [
  "bog-off",
  "lost-wanderer",
  "spa-day",
  "act-boss",
] as const;

/** One of the Quests. */
export type QuestId = (typeof QUEST_IDS)[number];

/** How far a Quest has got, in the order it goes through them. */
export type QuestState = "notGiven" | "given" | "ready" | "done";

/** What a Quest asks of the Hero; it counts whenever it happens. */
export type QuestTrigger =
  /** Talk to NPC `npc`, whom the Quest names. */
  | { type: "talk"; npc: string }
  /** Destroy `count` Bone Altars in Area `area`. */
  | { type: "boneAltars"; area: string; count: number }
  /** Kill the Unique Monster standing in Area `area`. */
  | { type: "uniqueKilled"; area: string }
  /** Kill the Act Boss of Act `act`. */
  | { type: "actBossKilled"; act: number };

/** What a Quest pays once, on Done. */
export type QuestReward =
  | { type: "attributePoints"; amount: number }
  | { type: "skillPoints"; amount: number }
  /** Unlocks the Smith's one-time service. */
  | { type: "smithService" }
  | { type: "none" };

/** The lines the giving NPC says, by how far the Quest has got. */
export type QuestLines = Record<QuestState, string>;

/** A Quest: who gives it, what it asks, what it pays and what is said. */
export type QuestDefinition = {
  /** What the Quest is called. */
  name: string;
  /** The Act it belongs to. */
  act: number;
  /** The name of the NPC who gives it and takes it back. */
  giver: string;
  trigger: QuestTrigger;
  reward: QuestReward;
  /** What the giver says in each state. */
  lines: QuestLines;
  /** What the Quest panel says to do next, once the Quest is Given. */
  nextStep: string;
};

export const questTuning: Record<QuestId, QuestDefinition> = {
  "bog-off": {
    name: "Bog Off",
    act: 1,
    giver: "Trader",
    trigger: { type: "boneAltars", area: "soggy-bog", count: 3 },
    reward: { type: "skillPoints", amount: 1 },
    lines: {
      notGiven:
        "Bone altars have sprouted all over the Soggy Bog, and my carts won't pass. Smash three of them and I'll make it worth your while.",
      given: "Three bone altars in the Soggy Bog, friend. Smash them all.",
      ready: "You did it! The bog is quiet. Here, take what I promised.",
      done: "The carts roll again. I owe you one.",
    },
    nextStep: "Destroy the Bone Altars in the Soggy Bog.",
  },
  "lost-wanderer": {
    name: "Lost Wanderer",
    act: 1,
    giver: "Elder",
    trigger: { type: "talk", npc: "Wanderer" },
    reward: { type: "attributePoints", amount: 5 },
    lines: {
      notGiven:
        "A wanderer has gone missing near the Old Mill. Find them, and send them home.",
      given: "Have you found the wanderer? The Old Mill, past the Soggy Bog.",
      ready: "They are home safe, thanks to you. Take this, with my thanks.",
      done: "The wanderer is home. We owe you much.",
    },
    nextStep: "Find the Wanderer in the Old Mill and talk to them.",
  },
  "spa-day": {
    name: "Spa Day",
    act: 1,
    giver: "Smith",
    trigger: { type: "uniqueKilled", area: "spa" },
    reward: { type: "smithService" },
    lines: {
      notGiven:
        "A Wockbrute calls himself Bruckle and has taken over the Spa. Mud baths, he says. Kill him, and I'll put my best work into your gear.",
      given:
        "Bruckle still lounges in the Spa. Mind his wolves, and mind that Slam.",
      ready: "Bruckle's bathed his last! Let me show you what my hands can do.",
      done: "Steel never lies. Mind your gear.",
    },
    nextStep: "Kill Bruckle in the Spa.",
  },
  "act-boss": {
    name: "Wock the Dead",
    act: 1,
    giver: "Elder",
    trigger: { type: "actBossKilled", act: 1 },
    reward: { type: "none" },
    lines: {
      notGiven:
        "Someone is raising the dead beneath the old stones. Stop them, Hero.",
      given: "The one raising the dead still lives. End them.",
      ready: "It is done. The dead lie still. You have saved us all.",
      done: "The dead lie still, thanks to you.",
    },
    nextStep: "Kill Grave Wockington in the Ossuary.",
  },
};
