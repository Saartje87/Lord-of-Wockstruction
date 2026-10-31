/** One Item as it sits in Save text, with every field a test may edit or remove. */
type ItemJson = {
  type: string;
  rarity?: string;
  rareName?: string | number;
  affixes: { kind: string; grade: number; value: number }[];
  cell?: { column: number; row: number };
};

/** The parts of Save text that the tampering tests edit. */
export type SaveJson = {
  inventory: ItemJson[];
  equipment: { weapon: ItemJson } & Record<string, ItemJson>;
  belt: unknown[][];
  smithBonuses?: unknown;
};

/** Save text parsed into a shape a test can tamper with, before `parseSave` is shown to refuse it. */
export function parseSaveJson(text: string): SaveJson {
  return JSON.parse(text);
}
