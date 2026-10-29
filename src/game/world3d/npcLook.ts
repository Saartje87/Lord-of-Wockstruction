import type { MonsterLook } from "./monsterLook";

/** An NPC's idle, which is every clip it plays: they stand and breathe. */
const idling = (clip: string): MonsterLook["clips"] => ({
  idle: clip,
  walk: clip,
  run: clip,
  flinch: clip,
  death: clip,
  attack: clip,
});

/** One of Town's NPCs, drawn as a KayKit Mystery Monthly character. */
const npc = (model: string, idle: string): MonsterLook => ({
  model,
  scale: 0.36,
  height: 0.9,
  clips: idling(idle),
  contact: 0.5,
  weapons: [],
});

/**
 * What each of Town's NPCs looks like, by their name in the map: the smith
 * is a Farmer, the elder the Lorekeeper, the trader the Hoarder with all his
 * pouches, and the wanderer the Cleric.
 */
export const NPC_LOOKS: Record<string, MonsterLook> = {
  Smith: npc("Farmer_A", "Idle_A"),
  Elder: npc("Lorekeeper", "Idle_B"),
  Trader: npc("Hoarder", "Idle_A"),
  Wanderer: npc("Cleric", "Idle_B"),
};
