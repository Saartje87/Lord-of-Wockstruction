import type { Graphics } from "pixi.js";
import type { Rect } from "../sim/rect";
import type { Branch, Skill } from "../tuning/skills";
import { skillTuning } from "../tuning/skills";

/** The colour of each Branch's icons. */
export const BRANCH_COLOURS: Record<Branch, number> = {
  bone: 0xe8e0c8,
  summoning: 0x7fd08a,
  curses: 0xc58be0,
};

/** What an icon is drawn with. A point is a fraction of the box, 0 to 1. */
type Pen = {
  graphics: Graphics;
  box: Rect;
  colour: number;
  alpha: number;
  /** Line width in px. */
  width: number;
};

type Point = [number, number];

const px = (pen: Pen, fx: number) => pen.box.x + pen.box.w * fx;
const py = (pen: Pen, fy: number) => pen.box.y + pen.box.h * fy;

function stroke(pen: Pen) {
  pen.graphics.stroke({
    color: pen.colour,
    width: pen.width,
    alpha: pen.alpha,
    cap: "round",
    join: "round",
  });
}

/** Strokes the polyline through `points`, closing it if asked. */
function line(pen: Pen, points: Point[], close = false) {
  const [first, ...rest] = points;
  pen.graphics.moveTo(px(pen, first[0]), py(pen, first[1]));
  for (const [fx, fy] of rest) pen.graphics.lineTo(px(pen, fx), py(pen, fy));
  if (close) pen.graphics.closePath();
  stroke(pen);
}

/** Fills the polygon through `points`. */
function solid(pen: Pen, points: Point[]) {
  pen.graphics
    .poly(points.flatMap(([fx, fy]) => [px(pen, fx), py(pen, fy)]))
    .fill({ color: pen.colour, alpha: pen.alpha });
}

function dot(pen: Pen, fx: number, fy: number, fr: number) {
  pen.graphics
    .circle(px(pen, fx), py(pen, fy), pen.box.w * fr)
    .fill({ color: pen.colour, alpha: pen.alpha });
}

function ring(pen: Pen, fx: number, fy: number, fr: number) {
  pen.graphics.circle(px(pen, fx), py(pen, fy), pen.box.w * fr);
  stroke(pen);
}

/** A curve from `from` to `to` bending toward `via`, stroked. */
function curve(pen: Pen, from: Point, via: Point, to: Point) {
  pen.graphics
    .moveTo(px(pen, from[0]), py(pen, from[1]))
    .quadraticCurveTo(
      px(pen, via[0]),
      py(pen, via[1]),
      px(pen, to[0]),
      py(pen, to[1]),
    );
  stroke(pen);
}

/** Each Skill's icon, drawn in the box of a `Pen` in its Branch's colour. */
export const SKILL_ICONS: Record<Skill, (pen: Pen) => void> = {
  // Bone: a burst, a spear, a wall of bricks, a fan of splinters, a shield
  // and a bone.
  corpseExplosion: (pen) => {
    const points: Point[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const r = i % 2 === 0 ? 0.5 : 0.22;
      points.push([0.5 + r * Math.cos(angle), 0.5 + r * Math.sin(angle)]);
    }
    solid(pen, points);
  },
  boneSpear: (pen) => {
    line(pen, [
      [0.12, 0.88],
      [0.68, 0.32],
    ]);
    solid(pen, [
      [0.9, 0.1],
      [0.52, 0.28],
      [0.72, 0.48],
    ]);
  },
  boneWall: (pen) => {
    solid(pen, [
      [0.05, 0.1],
      [0.95, 0.1],
      [0.95, 0.4],
      [0.05, 0.4],
    ]);
    solid(pen, [
      [0.05, 0.55],
      [0.45, 0.55],
      [0.45, 0.9],
      [0.05, 0.9],
    ]);
    solid(pen, [
      [0.58, 0.55],
      [0.95, 0.55],
      [0.95, 0.9],
      [0.58, 0.9],
    ]);
  },
  splinterVolley: (pen) => {
    for (const dx of [0, 0.3, 0.6]) {
      line(pen, [
        [0.08 + dx, 0.9],
        [0.28 + dx, 0.12],
      ]);
    }
  },
  boneWard: (pen) => {
    line(
      pen,
      [
        [0.12, 0.12],
        [0.88, 0.12],
        [0.88, 0.5],
        [0.5, 0.92],
        [0.12, 0.5],
      ],
      true,
    );
    line(pen, [
      [0.5, 0.2],
      [0.5, 0.78],
    ]);
  },
  ossifiedWill: (pen) => {
    line(pen, [
      [0.2, 0.8],
      [0.8, 0.2],
    ]);
    dot(pen, 0.16, 0.7, 0.1);
    dot(pen, 0.3, 0.86, 0.1);
    dot(pen, 0.84, 0.3, 0.1);
    dot(pen, 0.7, 0.14, 0.1);
  },
  // Summoning: a block-headed golem, a skull, a bow, a banner.
  golem: (pen) => {
    line(
      pen,
      [
        [0.15, 0.1],
        [0.85, 0.1],
        [0.85, 0.9],
        [0.15, 0.9],
      ],
      true,
    );
    dot(pen, 0.35, 0.4, 0.07);
    dot(pen, 0.65, 0.4, 0.07);
    line(pen, [
      [0.3, 0.72],
      [0.7, 0.72],
    ]);
  },
  raiseSkeleton: (pen) => {
    ring(pen, 0.5, 0.4, 0.32);
    dot(pen, 0.38, 0.4, 0.07);
    dot(pen, 0.62, 0.4, 0.07);
    line(pen, [
      [0.36, 0.78],
      [0.36, 0.95],
      [0.64, 0.95],
      [0.64, 0.78],
    ]);
  },
  raiseArcher: (pen) => {
    curve(pen, [0.3, 0.05], [0.9, 0.5], [0.3, 0.95]);
    line(pen, [
      [0.3, 0.05],
      [0.3, 0.95],
    ]);
    line(pen, [
      [0.05, 0.5],
      [0.7, 0.5],
    ]);
    solid(pen, [
      [0.98, 0.5],
      [0.7, 0.36],
      [0.7, 0.64],
    ]);
  },
  graveCommand: (pen) => {
    line(pen, [
      [0.2, 0.95],
      [0.2, 0.05],
    ]);
    solid(pen, [
      [0.2, 0.08],
      [0.9, 0.3],
      [0.2, 0.52],
    ]);
  },
  // Curses: arrows up and down, a weight, an eye and an hourglass.
  amplifyDamage: (pen) => {
    solid(pen, [
      [0.5, 0.05],
      [0.92, 0.5],
      [0.65, 0.5],
      [0.65, 0.95],
      [0.35, 0.95],
      [0.35, 0.5],
      [0.08, 0.5],
    ]);
  },
  weaken: (pen) => {
    line(pen, [
      [0.1, 0.15],
      [0.5, 0.5],
      [0.9, 0.15],
    ]);
    line(pen, [
      [0.1, 0.55],
      [0.5, 0.9],
      [0.9, 0.55],
    ]);
  },
  leadenLimbs: (pen) => {
    ring(pen, 0.5, 0.2, 0.15);
    solid(pen, [
      [0.3, 0.38],
      [0.7, 0.38],
      [0.95, 0.95],
      [0.05, 0.95],
    ]);
  },
  dread: (pen) => {
    curve(pen, [0.02, 0.5], [0.5, 0.05], [0.98, 0.5]);
    curve(pen, [0.02, 0.5], [0.5, 0.95], [0.98, 0.5]);
    dot(pen, 0.5, 0.5, 0.14);
  },
  lingeringMalice: (pen) => {
    solid(pen, [
      [0.15, 0.05],
      [0.85, 0.05],
      [0.5, 0.5],
    ]);
    solid(pen, [
      [0.5, 0.5],
      [0.85, 0.95],
      [0.15, 0.95],
    ]);
  },
};

/**
 * Draws `skill`'s icon in `box` at the UI Scale `scale`, in its Branch's
 * colour: for the Skill Tree panel, and for anything else that shows a
 * Skill by its icon.
 */
export function drawSkillIcon(
  graphics: Graphics,
  skill: Skill,
  box: Rect,
  scale: number,
  alpha = 1,
) {
  SKILL_ICONS[skill]({
    graphics,
    box,
    colour: BRANCH_COLOURS[skillTuning[skill].branch],
    alpha,
    width: Math.max(1.5, 2 * scale),
  });
}
