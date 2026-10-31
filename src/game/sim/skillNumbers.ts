import {
  DAMAGE_TYPES,
  type DamageShares,
  type DamageType,
} from "../tuning/damage";
import {
  type CastSkill,
  type CurseEffect,
  castTuning,
  type Skill,
} from "../tuning/skills";
import { minionDamageRange, minionMaxLife } from "./minions";
import { passiveMultiplier, skillPower } from "./synergies";
import { STEP_MS } from "./units";
import {
  curseRadius,
  curseSteps,
  explodeRadius,
  projectileDamage,
  raiseCount,
  skillManaCost,
  wardAmount,
} from "./world";

/** What a line of a cast Skill's numbers is about. */
export type SkillLineLabel =
  | "Count"
  | "Life"
  | "Damage"
  | "Effect"
  | "Radius"
  | "Duration"
  | "Soak"
  | "Length"
  | "Piece Life"
  | "Shards"
  | "Mana";

/** One line of what a cast Skill does at a Skill Level. */
export type SkillLine = {
  /** What the line is about, such as "Damage", "Radius" or "Mana". */
  label: SkillLineLabel;
  /** The number as shown, with its unit and Damage Types. */
  text: string;
  /** The main number: a range's mean, a share as a fraction, seconds, tiles. */
  value: number;
};

const TYPE_NAMES: Record<DamageType, string> = {
  physical: "Physical",
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
};

/** Numbers show whole, or with one decimal when they have one. */
function shown(n: number): string {
  return String(Number.isInteger(n) ? n : Number(n.toFixed(1)));
}

/** A fraction as a percent, without float dust. */
function percent(fraction: number): string {
  return shown(Math.round(fraction * 1000) / 10);
}

/** "+50%" or "-40%": how far `factor` is from 1. */
function change(factor: number): string {
  const by = Math.round((factor - 1) * 100);
  return `${by >= 0 ? "+" : "-"}${Math.abs(by)}%`;
}

/** The middle of a range. */
function mean([least, most]: [number, number]): number {
  return (least + most) / 2;
}

/** Damage Types as a hit splits over them: "Physical", or "50% Physical, 50% Fire". */
function typesText(shares?: DamageShares): string {
  const present = DAMAGE_TYPES.filter((type) => (shares?.[type] ?? 0) > 0);
  if (present.length === 0) return TYPE_NAMES.physical;
  if (present.length === 1) return TYPE_NAMES[present[0]];
  return present
    .map((type) => `${percent(shares?.[type] ?? 0)}% ${TYPE_NAMES[type]}`)
    .join(", ");
}

/**
 * A line about `label` with `value` as its main number, shown as `text`, or as
 * the value itself when no text is given.
 */
function line(
  label: SkillLineLabel,
  value: number,
  text = shown(value),
): SkillLine {
  return { label, text, value };
}

/** What a Curse does to a Monster, as a line. */
function curseEffect(effect: CurseEffect): SkillLine {
  switch (effect.kind) {
    case "amplifyDamage":
      return line(
        "Effect",
        effect.damageTaken,
        `Takes ${change(effect.damageTaken)} damage`,
      );
    case "weaken":
      return line(
        "Effect",
        effect.damageDealt,
        `Deals ${change(effect.damageDealt)} damage`,
      );
    case "leadenLimbs":
      return line(
        "Effect",
        effect.walkSpeed,
        `Walks ${change(effect.walkSpeed)} speed, attacks ${change(effect.attackSpeed)} speed`,
      );
    case "dread":
      return line("Effect", 0, "Flees");
  }
}

/**
 * What a cast Skill does at `skillLevel`, as lines worked out by the sim's own
 * functions, with the Synergies and Passive Skills that `skillLevels` (the
 * Hero's Skill Levels, Wand raises included) give it counted. The Mana cost
 * comes last; cast time, Projectile speed and range are left out.
 */
export function skillNumbers(
  skill: CastSkill,
  skillLevel: number,
  skillLevels: Record<Skill, number>,
): SkillLine[] {
  const { effect } = castTuning(skill);
  const power = skillPower(skillLevels, skill);
  const reach = passiveMultiplier(skillLevels, skill);
  const lines: SkillLine[] = [];
  switch (effect.type) {
    case "summon":
    case "raise": {
      if (effect.type === "raise") {
        lines.push(line("Count", raiseCount(effect, skillLevel)));
      }
      const minion = { type: effect.minion, skillLevel, synergy: power };
      const range = minionDamageRange(minion);
      lines.push(
        line("Life", minionMaxLife(minion)),
        line("Damage", mean(range), `${range[0]}-${range[1]}`),
      );
      break;
    }
    case "curse": {
      const radius = curseRadius(effect, skillLevel, reach);
      const seconds = (curseSteps(effect, skillLevel, power) * STEP_MS) / 1000;
      lines.push(
        curseEffect(effect),
        line("Radius", radius, `${shown(radius)} tiles`),
        line("Duration", seconds, `${shown(seconds)} seconds`),
      );
      break;
    }
    case "ward":
      lines.push(line("Soak", wardAmount(effect, skillLevel, power)));
      break;
    case "wall": {
      const seconds = effect.durationMs / 1000;
      lines.push(
        line("Length", effect.length, `${shown(effect.length)} tiles`),
        line("Piece Life", effect.pieceLife),
        line("Duration", seconds, `${shown(seconds)} seconds`),
      );
      break;
    }
    case "projectile":
    case "volley": {
      const damage = projectileDamage(effect, skillLevel, power);
      lines.push(
        line(
          "Damage",
          mean(damage),
          `${damage[0]}-${damage[1]} ${typesText()}`,
        ),
      );
      if (effect.type === "volley") lines.push(line("Shards", effect.shards));
      break;
    }
    case "explode": {
      const [least, most] = effect.share.map((share) => share * power);
      const radius = explodeRadius(effect, skillLevel);
      lines.push(
        line(
          "Damage",
          mean([least, most]),
          `${percent(least)}%-${percent(most)}% of Corpse Life (${typesText(effect.damageTypes)})`,
        ),
        line("Radius", radius, `${shown(radius)} tiles`),
      );
      break;
    }
  }
  lines.push(line("Mana", skillManaCost(skill, skillLevel)));
  return lines;
}
