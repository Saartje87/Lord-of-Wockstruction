// PROTOTYPE (throwaway): HUD variants for ticket #86.
// Grown from the #82 Monster sandbox, with the #83 numbers, In Combat, regeneration
// and the click-to-return death flow. No tests, no abstractions.

import {
  type Application,
  ColorMatrixFilter,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Text,
} from "pixi.js";
import type { HudConfig, MonsterConfig } from "./variants";

const TW = 64; // tile width in px
const TH = 32; // tile height in px
const WALL_H = 26;
const SIZE = 40;
const HERO_R = 0.3;
const MON_R = 0.32;
const START: Vec = { x: 3.5, y: 3.5 };

// Hero feel, settled in #77 (variant C).
const FEEL = {
  speed: 5.5,
  attackTime: 0.35,
  hitFrac: 0.4,
  range: 1.0,
  hitstopMs: 60,
};

// #83 numbers
const HERO_HIT = [20, 30];
const MONSTER_HIT = [4, 8];
const REGEN = 2; // Life per second when not In Combat
const CALM_AFTER = 5; // seconds without damage before regeneration
const roll = ([lo, hi]: number[]) =>
  lo + Math.floor(Math.random() * (hi - lo + 1));

type Vec = { x: number; y: number };
type MonState =
  | "idle"
  | "wander"
  | "chase"
  | "windup"
  | "recover"
  | "flinch"
  | "return"
  | "dead";
type Monster = {
  id: number;
  pack: number;
  home: Vec;
  x: number;
  y: number;
  life: number;
  state: MonState;
  t: number; // timer for the current state
  cd: number; // seconds until it may swing again
  facing: number;
  path: Vec[];
  repathT: number;
  wanderGoal: Vec | null;
  flash: number;
  swingDir: number;
};
type Action =
  | { kind: "move"; to: Vec }
  | { kind: "attack"; target: Monster }
  | { kind: "inPlace"; to: Vec };
type HeroState = "idle" | "moving" | "approach" | "swing" | "flinch" | "dead";

export type MonsterSnapshot = {
  hero: string;
  life: string;
  inCombat: string;
  deaths: number;
  kills: number;
  hitsTaken: number;
  monsters: string;
};

/** What a DOM HUD reads every frame. */
export type HudView = {
  life: number;
  maxLife: number;
  inCombat: boolean;
  /** seconds until regeneration starts, null if a Monster is chasing */
  calmIn: number | null;
  regenerating: boolean;
  /** 0..1 red flash */
  flash: number;
  dead: boolean;
  /** seconds since death */
  deadT: number;
  /** 0..1 black fade during the return to Town */
  fade: number;
  hovered: { name: string; life: number; maxLife: number } | null;
  /** screen positions of the bar anchor over each living Monster */
  bars: {
    id: number;
    x: number;
    y: number;
    life: number;
    maxLife: number;
    hovered: boolean;
  }[];
};

// --- grid -----------------------------------------------------------------

function makeGrid(): boolean[][] {
  const walk: boolean[][] = [];
  for (let y = 0; y < SIZE; y++) {
    walk.push([]);
    for (let x = 0; x < SIZE; x++) {
      const edge = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
      walk[y].push(!edge);
    }
  }
  const walls: [number, number, number, number][] = [
    // x0,y0,x1,y1 inclusive
    [8, 1, 8, 6], // wall beside the start
    [8, 9, 8, 12],
    [16, 6, 22, 6], // room round pack 2
    [16, 6, 16, 11],
    [16, 15, 16, 20],
    [16, 20, 22, 20],
    [27, 6, 27, 20],
    [3, 18, 10, 18], // corridor to pack 3
    [3, 22, 6, 22],
    [10, 22, 10, 30],
    [20, 26, 21, 27], // pillars
    [26, 30, 27, 31],
    [30, 24, 31, 25],
  ];
  for (const [x0, y0, x1, y1] of walls)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) walk[y][x] = false;
  return walk;
}

const PACKS: Vec[][] = [
  [{ x: 12.5, y: 4.5 }],
  [
    { x: 12.5, y: 13.5 },
    { x: 13.5, y: 12.5 },
    { x: 13.5, y: 14.5 },
  ],
  [
    { x: 20.5, y: 12.5 },
    { x: 21.5, y: 13.5 },
    { x: 20.5, y: 14.5 },
    { x: 22.5, y: 12.5 },
    { x: 22.5, y: 14.5 },
  ],
  [
    { x: 5.5, y: 26.5 },
    { x: 6.5, y: 27.5 },
    { x: 4.5, y: 28.5 },
    { x: 7.5, y: 25.5 },
  ],
  [
    { x: 24.5, y: 28.5 },
    { x: 25.5, y: 27.5 },
    { x: 23.5, y: 27.5 },
    { x: 24.5, y: 26.5 },
    { x: 26.5, y: 28.5 },
    { x: 23.5, y: 29.5 },
    { x: 25.5, y: 29.5 },
  ],
  [
    { x: 33.5, y: 8.5 },
    { x: 34.5, y: 9.5 },
  ],
];

const project = (x: number, y: number): Vec => ({
  x: ((x - y) * TW) / 2,
  y: ((x + y) * TH) / 2,
});
const unproject = (sx: number, sy: number): Vec => ({
  x: (sx / (TW / 2) + sy / (TH / 2)) / 2,
  y: (sy / (TH / 2) - sx / (TW / 2)) / 2,
});
/** Angle of a world-space delta as seen on screen. */
const screenAngle = (dx: number, dy: number) =>
  Math.atan2(((dx + dy) * TH) / 2, ((dx - dy) * TW) / 2);
const angleDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const centre = (t: Vec): Vec => ({ x: t.x + 0.5, y: t.y + 0.5 });
const tileOf = (p: Vec): Vec => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

function astar(walk: boolean[][], from: Vec, to: Vec): Vec[] | null {
  const ok = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE && walk[y][x];
  if (!ok(to.x, to.y)) return null;
  const key = (x: number, y: number) => y * SIZE + x;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open: { k: number; f: number }[] = [
    { k: key(from.x, from.y), f: h(from.x, from.y) },
  ];
  g.set(key(from.x, from.y), 0);
  const closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift() as { k: number; f: number };
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const cx = cur.k % SIZE;
    const cy = Math.floor(cur.k / SIZE);
    if (cx === to.x && cy === to.y) {
      const out: Vec[] = [];
      let k: number | undefined = cur.k;
      while (k !== undefined) {
        out.unshift({ x: k % SIZE, y: Math.floor(k / SIZE) });
        k = came.get(k);
      }
      return out;
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue; // no corner cutting
        const nk = key(nx, ny);
        const ng = (g.get(cur.k) as number) + (dx && dy ? Math.SQRT2 : 1);
        if (ng < (g.get(nk) ?? Number.POSITIVE_INFINITY)) {
          g.set(nk, ng);
          came.set(nk, cur.k);
          open.push({ k: nk, f: ng + h(nx, ny) });
        }
      }
  }
  return null;
}

function lineOfSight(walk: boolean[][], a: Vec, b: Vec, r = HERO_R) {
  const d = dist(a, b);
  const steps = Math.ceil(d / 0.1);
  const px = d ? (-(b.y - a.y) / d) * r : 0;
  const py = d ? ((b.x - a.x) / d) * r : 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    for (const [ox, oy] of [
      [0, 0],
      [px, py],
      [-px, -py],
    ]) {
      const tx = Math.floor(x + ox);
      const ty = Math.floor(y + oy);
      if (!walk[ty]?.[tx]) return false;
    }
  }
  return true;
}

/** A* plus string pulling, from `from` to the point `to`. */
function planPath(walk: boolean[][], from: Vec, to: Vec, r: number) {
  const tiles = astar(walk, tileOf(from), tileOf(to));
  if (!tiles) return null;
  const pts = tiles.slice(1).map(centre);
  if (!pts.length) pts.push(to);
  else pts[pts.length - 1] = to;
  const out: Vec[] = [];
  let at: Vec = from;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineOfSight(walk, at, pts[j], r)) j--;
    out.push(pts[j]);
    at = pts[j];
    i = j + 1;
  }
  return out;
}

// --- game -----------------------------------------------------------------

export function startHudGame(
  app: Application,
  cfg: MonsterConfig,
  hc: HudConfig,
  ui: { blocked: () => boolean; toggleMenu: () => void },
) {
  const walk = makeGrid();
  const free = (x: number, y: number) =>
    walk[Math.floor(y)]?.[Math.floor(x)] === true;
  const world = new Container();
  const floor = new Graphics();
  const g = new Graphics();
  const popups = new Container();
  const ring = new Graphics(); // variant C: Life ring under the Hero, drawn in the world
  const hud = new Graphics();
  const hudText = new Container();
  const banner = new Text({
    text: "",
    style: {
      fill: 0xb01818,
      fontSize: 64,
      fontFamily: "Georgia, serif",
      align: "center",
      dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 1 },
    },
  });
  banner.anchor.set(0.5);
  const hint = new Text({
    text: "Click to return to Town",
    style: { fill: 0xc8bfa8, fontSize: 18, fontFamily: "Georgia, serif" },
  });
  hint.anchor.set(0.5);
  const plate = new Text({
    text: "",
    style: { fill: 0xe8e0c8, fontSize: 16, fontFamily: "Georgia, serif" },
  });
  plate.anchor.set(0.5, 0);
  const badge = new Text({
    text: "",
    style: { fill: 0xe8e0c8, fontSize: 13, fontFamily: "Georgia, serif" },
  });
  badge.anchor.set(0.5, 1);
  const menuText = new Text({
    text: "",
    style: {
      fill: 0xe8e0c8,
      fontSize: 15,
      fontFamily: "Georgia, serif",
      align: "center",
      lineHeight: 22,
    },
  });
  menuText.anchor.set(0.5);
  hudText.addChild(plate, badge, banner, hint, menuText);
  world.addChild(floor, ring, g, popups);
  app.stage.addChild(world, hud, hudText);
  const grey = new ColorMatrixFilter();
  grey.desaturate();
  let pixiMenu = false;

  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (
        !walk[y][x] &&
        (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1)
      )
        continue;
      const pts = [
        project(x, y),
        project(x + 1, y),
        project(x + 1, y + 1),
        project(x, y + 1),
      ];
      const nearStart = x < 8 && y < 8;
      floor
        .poly(pts.flatMap((p) => [p.x, p.y]))
        .fill({
          color: nearStart
            ? (x + y) % 2
              ? 0x2d3a2d
              : 0x283428
            : (x + y) % 2
              ? 0x2a2a30
              : 0x24242a,
        })
        .stroke({ width: 1, color: 0x34343c });
    }

  const hero = {
    ...START,
    life: cfg.heroLife,
    facing: screenAngle(1, 1),
    state: "idle" as HeroState,
    t: 0,
    path: [] as Vec[],
    target: null as Monster | null,
    swingT: 0,
    swingHit: false,
    swingDir: 0,
    repathT: 0,
    queued: null as Action | null,
    flash: 0,
  };
  let monsters: Monster[] = [];
  function spawnMonsters() {
    let id = 0;
    monsters = PACKS.flatMap((pack, p) =>
      pack.map((pos) => ({
        id: id++,
        pack: p,
        home: { ...pos },
        ...pos,
        life: cfg.monsterLife,
        state: (cfg.wander ? "wander" : "idle") as MonState,
        t: Math.random() * 2,
        cd: 0,
        facing: screenAngle(-1, -1),
        path: [],
        repathT: 0,
        wanderGoal: null,
        flash: 0,
        swingDir: 0,
      })),
    );
  }
  spawnMonsters();

  const input = {
    screen: { x: 0, y: 0 },
    held: false,
    shift: false,
    heldKind: null as Action["kind"] | null,
    heldTarget: null as Monster | null,
    reissueT: 0,
  };
  let marker: { p: Vec; t: number } | null = null;
  let hitstop = 0;
  let deaths = 0;
  let kills = 0;
  let hitsTaken = 0;
  let sinceDamage = 99;
  let inCombat = false;
  let chased = false;
  let now = 0;
  let hoveredMonster: Monster | null = null;
  let fade = 0; // >0 while returning to Town: 0.3 s out, then 0.3 s back in

  const alive = (m: Monster) => m.state !== "dead";
  const cursorWorld = () => {
    const local = world.toLocal(input.screen);
    return unproject(local.x, local.y);
  };
  const monsterUnderCursor = () => {
    const local = world.toLocal(input.screen);
    let best: Monster | null = null;
    let bestD = 22;
    for (const m of monsters) {
      if (!alive(m)) continue;
      const s = project(m.x, m.y);
      const dd = Math.hypot(local.x - s.x, local.y - (s.y - 18));
      if (dd < bestD) {
        bestD = dd;
        best = m;
      }
    }
    return best;
  };

  type Popup = Text & { life: number; max: number; vx: number; vy: number };
  function popup(at: Vec, text: string, fill: number, amount = 25) {
    if (hc.numbers === "none") return;
    const s = project(at.x, at.y);
    const arc = hc.numbers === "arc";
    const t = new Text({
      text,
      style: arc
        ? {
            fill,
            fontSize: 12 + amount * 0.5,
            fontWeight: "900",
            stroke: { color: 0x000000, width: 3 },
          }
        : {
            fill,
            fontSize: 15,
            fontFamily: "Georgia, serif",
            stroke: { color: 0x000000, width: 2 },
          },
    }) as Popup;
    t.anchor.set(0.5);
    t.position.set(s.x, s.y - 44);
    t.max = t.life = arc ? 0.8 : 0.9;
    t.vx = arc ? (Math.random() - 0.5) * 120 : 0;
    t.vy = arc ? -170 : -30;
    popups.addChild(t);
  }

  // --- Hero orders (variant C from #77) ---

  function startSwing(dir: number, target: Monster | null) {
    hero.state = "swing";
    hero.swingT = 0;
    hero.swingHit = false;
    hero.swingDir = dir;
    hero.facing = dir;
    hero.target = target;
    hero.path = [];
  }

  const inRange = (m: Monster) =>
    alive(m) && dist(hero, m) <= FEEL.range + MON_R;

  function execute(a: Action) {
    if (a.kind === "move") {
      const p = planPath(walk, hero, a.to, HERO_R);
      marker = { p: a.to, t: 0.6 };
      if (!p) return;
      hero.path = p;
      hero.target = null;
      hero.state = p.length ? "moving" : "idle";
    } else if (a.kind === "attack") {
      hero.target = a.target;
      if (inRange(a.target))
        startSwing(
          screenAngle(a.target.x - hero.x, a.target.y - hero.y),
          a.target,
        );
      else {
        hero.state = "approach";
        hero.path = planPath(walk, hero, a.target, HERO_R) ?? [];
        hero.repathT = 0.3;
      }
    } else {
      startSwing(screenAngle(a.to.x - hero.x, a.to.y - hero.y), null);
    }
  }

  function order(a: Action) {
    if (hero.state === "dead") return;
    if (hero.state === "flinch") {
      hero.queued = a;
      return;
    }
    if (hero.state === "swing") {
      if (hero.swingHit && a.kind === "move") return execute(a);
      hero.queued = a;
      return;
    }
    execute(a);
  }

  function actionAtCursor(): Action {
    const m = monsterUnderCursor();
    if (m) return { kind: "attack", target: m };
    if (input.shift) return { kind: "inPlace", to: cursorWorld() };
    return { kind: "move", to: cursorWorld() };
  }

  // --- input ---

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  const onDown = (e: FederatedPointerEvent) => {
    if (e.button !== 0) return;
    if (pixiMenu) {
      pixiMenu = false;
      return;
    }
    if (ui.blocked() || fade > 0) return;
    if (hero.state === "dead") {
      // "You died" shows after 1 s; a click then fades back to Town
      if (hero.t >= 1) fade = 0.6;
      return;
    }
    input.screen = { x: e.global.x, y: e.global.y };
    input.shift = e.shiftKey;
    input.held = true;
    const a = actionAtCursor();
    input.heldKind = a.kind;
    input.heldTarget = a.kind === "attack" ? a.target : null;
    input.reissueT = 0.12;
    order(a);
  };
  const onMove = (e: FederatedPointerEvent) => {
    input.screen = { x: e.global.x, y: e.global.y };
  };
  const onUp = () => {
    input.held = false;
    input.heldKind = null;
    input.heldTarget = null;
  };
  app.stage.on("pointerdown", onDown);
  app.stage.on("pointermove", onMove);
  app.stage.on("pointerup", onUp);
  app.stage.on("pointerupoutside", onUp);
  const onKey = (e: KeyboardEvent) => {
    input.shift = e.shiftKey;
    if (e.type !== "keydown") return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("input, textarea, select")) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "h" || e.key === "H") hero.life = cfg.heroLife;
    if (e.key === "k" || e.key === "K") hero.life = Math.min(hero.life, 1);
    if (e.key === "Escape") {
      if (hc.layer === "pixi") pixiMenu = !pixiMenu;
      else ui.toggleMenu();
    }
  };
  const noMenu = (e: MouseEvent) => e.preventDefault();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  app.canvas.addEventListener("contextmenu", noMenu);

  function reset() {
    sinceDamage = 99;
    Object.assign(hero, {
      ...START,
      life: cfg.heroLife,
      flash: 0,
      state: "idle",
      path: [],
      target: null,
      queued: null,
    });
    spawnMonsters();
  }

  // --- Hero simulation ---

  function heroHits(m: Monster) {
    const dmg = roll(HERO_HIT);
    m.life -= dmg;
    m.flash = 0.12;
    hitstop = FEEL.hitstopMs / 1000;
    if (m.life <= 0) {
      m.life = 0;
      m.state = "dead";
      m.t = 0;
      kills++;
      popup(m, `${dmg}`, 0xffd04a, dmg);
      return;
    }
    popup(m, `${dmg}`, 0xffffff, dmg);
    if (m.state === "idle" || m.state === "wander" || m.state === "return")
      aggro(m);
    const canFlinch = m.state !== "windup" || cfg.flinchInterrupts;
    if (canFlinch && Math.random() < cfg.flinchChance) {
      m.state = "flinch";
      m.t = cfg.flinchTime;
      m.path = [];
    }
  }

  function afterHeroAction() {
    hero.state = "idle";
    const q = hero.queued;
    hero.queued = null;
    if (q) return execute(q);
    if (!input.held) return;
    if (input.heldKind === "attack") {
      const t = input.heldTarget;
      if (t && alive(t)) execute({ kind: "attack", target: t });
    } else if (input.heldKind === "inPlace") {
      execute({ kind: "inPlace", to: cursorWorld() });
    } else if (input.heldKind === "move") {
      execute({ kind: "move", to: cursorWorld() });
    }
  }

  function stepHero(dt: number) {
    hero.flash = Math.max(0, hero.flash - dt);
    if (hero.state === "dead") {
      hero.t += dt;
      return;
    }
    if (hero.state === "flinch") {
      hero.t -= dt;
      if (hero.t <= 0) afterHeroAction();
      return;
    }

    // hold-to-steer
    const canSteer = hero.state !== "swing" || hero.swingHit;
    if (input.held && input.heldKind === "move" && canSteer) {
      input.reissueT -= dt;
      if (input.reissueT <= 0) {
        input.reissueT = 0.12;
        const m = monsterUnderCursor();
        if (m) {
          input.heldKind = "attack";
          input.heldTarget = m;
          order({ kind: "attack", target: m });
        } else order({ kind: "move", to: cursorWorld() });
      }
    }

    if (hero.state === "approach" && hero.target) {
      const t = hero.target;
      if (!alive(t)) {
        hero.state = "idle";
        hero.path = [];
      } else if (inRange(t)) {
        startSwing(screenAngle(t.x - hero.x, t.y - hero.y), t);
      } else {
        hero.repathT -= dt;
        if (hero.repathT <= 0 || !hero.path.length) {
          hero.repathT = 0.2;
          hero.path = planPath(walk, hero, t, HERO_R) ?? hero.path;
        }
      }
    }

    if (
      (hero.state === "moving" || hero.state === "approach") &&
      hero.path.length
    ) {
      let budget = FEEL.speed * dt;
      while (budget > 0 && hero.path.length) {
        const n = hero.path[0];
        const d = dist(hero, n);
        if (d > 0.0001) hero.facing = screenAngle(n.x - hero.x, n.y - hero.y);
        if (d <= budget) {
          hero.x = n.x;
          hero.y = n.y;
          hero.path.shift();
          budget -= d;
        } else {
          hero.x += ((n.x - hero.x) / d) * budget;
          hero.y += ((n.y - hero.y) / d) * budget;
          budget = 0;
        }
        if (hero.state === "approach" && hero.target && inRange(hero.target)) {
          hero.path = [];
          break;
        }
      }
      if (!hero.path.length && hero.state === "moving") hero.state = "idle";
    }

    if (hero.state === "swing") {
      hero.swingT += dt;
      if (!hero.swingHit && hero.swingT >= FEEL.hitFrac * FEEL.attackTime) {
        hero.swingHit = true;
        const victims = monsters.filter((m) => {
          if (!alive(m)) return false;
          if (hero.target)
            return m === hero.target && dist(hero, m) <= FEEL.range + 0.6;
          return (
            dist(hero, m) <= FEEL.range + MON_R &&
            angleDiff(screenAngle(m.x - hero.x, m.y - hero.y), hero.swingDir) <
              (50 * Math.PI) / 180
          );
        });
        for (const v of victims) heroHits(v);
      }
      if (hero.swingT >= FEEL.attackTime) afterHeroAction();
    }
  }

  // --- Monster simulation ---

  function aggro(m: Monster) {
    m.state = "chase";
    m.repathT = 0;
    if (cfg.spreadRadius <= 0) return;
    for (const o of monsters)
      if (
        (o.state === "idle" || o.state === "wander") &&
        dist(o, m) <= cfg.spreadRadius
      ) {
        o.state = "chase";
        o.repathT = Math.random() * 0.3; // a ragged wake-up reads better than a synced one
      }
  }

  /** Walk towards `to` at `speed`. Uses the Monster's path or a direct line per config. */
  function walkTowards(m: Monster, to: Vec, speed: number, dt: number) {
    let goal = to;
    if (cfg.pathing === "astar" && !lineOfSight(walk, m, to, MON_R)) {
      m.repathT -= dt;
      if (m.repathT <= 0 || !m.path.length) {
        m.repathT = 0.4;
        m.path = planPath(walk, m, to, MON_R) ?? [];
      }
      while (m.path.length && dist(m, m.path[0]) < 0.05) m.path.shift();
      if (m.path.length) goal = m.path[0];
    } else m.path = [];
    const d = dist(m, goal);
    if (d < 0.001) return;
    m.facing = screenAngle(goal.x - m.x, goal.y - m.y);
    const step = Math.min(d, speed * dt);
    const nx = m.x + ((goal.x - m.x) / d) * step;
    const ny = m.y + ((goal.y - m.y) / d) * step;
    // slide along walls, axis by axis
    if (free(nx, m.y)) m.x = nx;
    if (free(m.x, ny)) m.y = ny;
  }

  function stepMonster(m: Monster, dt: number, attacking: number) {
    m.flash = Math.max(0, m.flash - dt);
    m.cd = Math.max(0, m.cd - dt);
    const dHero = dist(m, hero);
    const heroAlive = hero.state !== "dead";
    const noticed =
      heroAlive &&
      dHero <= cfg.aggroRadius &&
      (!cfg.needsSight || lineOfSight(walk, m, hero, 0));

    switch (m.state) {
      case "dead":
        return;
      case "idle":
        if (noticed) aggro(m);
        else if (cfg.wander) m.state = "wander";
        return;
      case "wander": {
        if (noticed) return aggro(m);
        if (!cfg.wander) {
          m.state = "idle";
          return;
        }
        m.t -= dt;
        if (m.t > 0) return;
        if (!m.wanderGoal) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * cfg.wanderRadius;
          const p = {
            x: m.home.x + Math.cos(a) * r,
            y: m.home.y + Math.sin(a) * r,
          };
          if (free(p.x, p.y) && lineOfSight(walk, m, p, MON_R))
            m.wanderGoal = p;
          return;
        }
        walkTowards(m, m.wanderGoal, cfg.monsterSpeed * 0.35, dt);
        if (dist(m, m.wanderGoal) < 0.1) {
          m.wanderGoal = null;
          m.t = 1 + Math.random() * 2.5;
        }
        return;
      }
      case "chase": {
        if (!heroAlive) {
          m.state = "return";
          return;
        }
        if (cfg.leash > 0 && dist(m, m.home) > cfg.leash) {
          m.state = "return";
          m.path = [];
          popup(m, "gives up", 0x9aa0aa);
          return;
        }
        const reach = cfg.reach + HERO_R;
        const slotFree = cfg.maxAttackers <= 0 || attacking < cfg.maxAttackers;
        if (dHero <= reach) {
          m.facing = screenAngle(hero.x - m.x, hero.y - m.y);
          if (m.cd <= 0 && slotFree) {
            m.state = "windup";
            m.t = 0;
            m.swingDir = m.facing;
          }
          return;
        }
        // Waiting for an attack slot: hang back just outside reach.
        if (!slotFree && dHero <= reach + 0.8) {
          m.facing = screenAngle(hero.x - m.x, hero.y - m.y);
          return;
        }
        walkTowards(m, hero, cfg.monsterSpeed, dt);
        return;
      }
      case "windup":
        m.t += dt;
        if (m.t >= cfg.windUp) {
          const inArc =
            dHero <= cfg.reach + HERO_R + 0.25 &&
            angleDiff(screenAngle(hero.x - m.x, hero.y - m.y), m.swingDir) <
              (60 * Math.PI) / 180;
          if (inArc && heroAlive) monsterHits(m);
          m.state = "recover";
          m.t = 0.2; // follow-through: rooted briefly after the swing
          m.cd = cfg.recovery + Math.random() * cfg.jitter;
        }
        return;
      case "recover":
        m.t -= dt;
        if (m.t <= 0) m.state = "chase";
        return;
      case "flinch":
        m.t -= dt;
        if (m.t <= 0) m.state = "chase";
        return;
      case "return":
        walkTowards(m, m.home, cfg.monsterSpeed * 1.2, dt);
        m.life = Math.min(cfg.monsterLife, m.life + cfg.monsterLife * dt);
        if (dist(m, m.home) < 0.15) {
          m.state = cfg.wander ? "wander" : "idle";
          m.t = 2; // brief grace so it doesn't instantly re-aggro on arrival
          m.life = cfg.monsterLife;
        }
        return;
    }
  }

  function monsterHits(_m: Monster) {
    const dmg = roll(MONSTER_HIT);
    hero.life -= dmg;
    hero.flash = 0.15;
    sinceDamage = 0;
    hitsTaken++;
    popup(hero, `${dmg}`, 0xff4a4a, dmg);
    if (hero.life <= 0) {
      hero.life = 0;
      hero.state = "dead";
      hero.t = 0;
      hero.path = [];
      hero.queued = null;
      deaths++;
      return;
    }
    const cancelable = hero.state !== "swing" || !hero.swingHit;
    if (cancelable && Math.random() < cfg.heroFlinchChance) {
      hero.state = "flinch";
      hero.t = cfg.heroFlinchTime;
      hero.path = [];
    }
  }

  /** Circle separation: Monsters get pushed out of each other and out of the Hero. */
  function separate() {
    const live = monsters.filter(alive);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      const dh = dist(a, hero);
      const minH = MON_R + HERO_R;
      if (hero.state !== "dead" && dh < minH && dh > 0.0001) {
        const push = (minH - dh) / dh;
        const nx = a.x + (a.x - hero.x) * push;
        const ny = a.y + (a.y - hero.y) * push;
        if (free(nx, ny)) {
          a.x = nx;
          a.y = ny;
        }
      }
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const d = dist(a, b);
        if (d >= MON_R * 2) continue;
        const ux = d > 0.0001 ? (b.x - a.x) / d : Math.random() - 0.5;
        const uy = d > 0.0001 ? (b.y - a.y) / d : Math.random() - 0.5;
        const half = (MON_R * 2 - d) / 2;
        if (free(a.x - ux * half, a.y - uy * half)) {
          a.x -= ux * half;
          a.y -= uy * half;
        }
        if (free(b.x + ux * half, b.y + uy * half)) {
          b.x += ux * half;
          b.y += uy * half;
        }
      }
    }
  }

  function step(dt: number) {
    if (fade > 0) {
      const before = fade;
      fade = Math.max(0, fade - dt);
      if (before > 0.3 && fade <= 0.3) reset(); // stands in for "arrive at Town start"
    }
    stepHero(dt);
    sinceDamage += dt;
    chased =
      hero.state !== "dead" &&
      monsters.some(
        (m) =>
          m.state === "chase" || m.state === "windup" || m.state === "recover",
      );
    inCombat = hero.state !== "dead" && (sinceDamage < CALM_AFTER || chased);
    if (!inCombat && hero.state !== "dead")
      hero.life = Math.min(cfg.heroLife, hero.life + REGEN * dt);
    let attacking = monsters.filter((m) => m.state === "windup").length;
    for (const m of monsters) {
      const was = m.state;
      stepMonster(m, dt, attacking);
      if (was !== "windup" && m.state === "windup") attacking++;
      if (was === "windup" && m.state !== "windup") attacking--;
    }
    separate();
  }

  // --- rendering ---

  function drawDiamond(t: Vec, color: number, alpha: number) {
    const pts = [
      project(t.x, t.y),
      project(t.x + 1, t.y),
      project(t.x + 1, t.y + 1),
      project(t.x, t.y + 1),
    ];
    g.poly(pts.flatMap((p) => [p.x, p.y])).stroke({ width: 2, color, alpha });
  }

  function drawWall(x: number, y: number) {
    const a = project(x, y);
    const b = project(x + 1, y);
    const c = project(x + 1, y + 1);
    const d = project(x, y + 1);
    const up = (p: Vec) => [p.x, p.y - WALL_H];
    g.poly([...up(a), ...up(b), ...up(c), ...up(d)]).fill({ color: 0x6b6258 });
    g.poly([d.x, d.y, c.x, c.y, ...up(c), ...up(d)]).fill({ color: 0x4a443d });
    g.poly([c.x, c.y, b.x, b.y, ...up(b), ...up(c)]).fill({ color: 0x3a352f });
  }

  /** An iso circle of `r` tiles around `p`, as an ellipse on screen. */
  function isoRing(p: Vec, r: number, color: number, alpha: number) {
    const s = project(p.x, p.y);
    g.ellipse(s.x, s.y, (r * TW) / Math.SQRT2, (r * TH) / Math.SQRT2).stroke({
      width: 1,
      color,
      alpha,
    });
  }

  /** A wedge on the ground in front of an entity, `frac` of the way out. */
  function wedge(
    p: Vec,
    dir: number,
    reach: number,
    halfDeg: number,
    color: number,
    alpha: number,
  ) {
    const s = project(p.x, p.y);
    const half = (halfDeg * Math.PI) / 180;
    g.moveTo(s.x, s.y)
      .arc(s.x, s.y, (reach * TW) / 2, dir - half, dir + half)
      .closePath()
      .fill({ color, alpha });
  }

  function drawMonster(m: Monster) {
    const s = project(m.x, m.y);
    if (cfg.showRadii && (m.state === "idle" || m.state === "wander")) {
      isoRing(m, cfg.aggroRadius, 0xffd04a, 0.18);
      if (cfg.spreadRadius > 0) isoRing(m, cfg.spreadRadius, 0x6aa8ff, 0.12);
    }
    if (cfg.showRadii && cfg.leash > 0 && m.state === "chase")
      isoRing(m.home, cfg.leash, 0x9aa0aa, 0.1);
    g.ellipse(s.x, s.y, 13, 6.5).fill({ color: 0x000000, alpha: 0.35 });
    if (m.state === "dead") {
      g.rect(s.x - 14, s.y - 5, 28, 6).fill({ color: 0x5a5448 });
      g.circle(s.x + 12, s.y - 4, 4).fill({ color: 0x6a6458 });
      return;
    }
    if (m.state === "windup") {
      // the telegraph: a red wedge filling up over the wind-up
      const p = Math.min(1, m.t / cfg.windUp);
      const reach = cfg.reach + HERO_R;
      wedge(m, m.swingDir, reach, 60, 0xff3030, 0.08);
      wedge(m, m.swingDir, reach * p, 60, 0xff3030, 0.15 + 0.35 * p);
    }
    const tilt = m.state === "flinch" ? 5 : 0;
    const bone =
      m.flash > 0
        ? 0xffffff
        : m.state === "windup"
          ? 0xff9a7a
          : m.state === "return"
            ? 0x8a8a90
            : m.state === "idle" || m.state === "wander"
              ? 0xb8b2a0
              : 0xe2dcc8;
    const lean = m.state === "windup" ? -Math.min(1, m.t / cfg.windUp) * 4 : 0;
    g.rect(s.x - 6 + tilt, s.y - 30 + lean, 12, 26).fill({ color: bone });
    g.circle(s.x + tilt, s.y - 36 + lean, 7).fill({ color: bone });
    // eyes show facing
    const ex = Math.cos(m.facing) * 3;
    g.circle(s.x + tilt + ex - 2, s.y - 37 + lean, 1.6).fill({
      color: m.state === "chase" || m.state === "windup" ? 0xff3030 : 0x222222,
    });
    g.circle(s.x + tilt + ex + 2, s.y - 37 + lean, 1.6).fill({
      color: m.state === "chase" || m.state === "windup" ? 0xff3030 : 0x222222,
    });
    if (m.state === "idle" || m.state === "wander")
      g.circle(s.x + 9, s.y - 46, 2).fill({ color: 0x9aa0aa, alpha: 0.6 });
    const hovered = m === hoveredMonster;
    if (hovered)
      // Diablo-style hover: outline the Monster
      g.rect(s.x - 10, s.y - 46, 20, 46).stroke({
        width: 1.5,
        color: 0xd8c890,
        alpha: 0.8,
      });
    // DOM variants draw bars as HTML over the canvas
    if (hc.layer === "dom") return;
    const showBar =
      hc.monsterBars === "always" ||
      (hc.monsterBars === "damaged" && m.life < cfg.monsterLife) ||
      (hc.monsterBars === "hover" && hovered);
    if (showBar) {
      g.rect(s.x - 15, s.y - 53, 30, 5).fill({ color: 0x000000, alpha: 0.7 });
      g.rect(s.x - 14, s.y - 52, (28 * m.life) / cfg.monsterLife, 3).fill({
        color: 0xc02020,
      });
    }
  }

  function drawHero() {
    const s = project(hero.x, hero.y);
    g.ellipse(s.x, s.y, 12, 6).fill({ color: 0x000000, alpha: 0.35 });
    if (hero.state === "dead") {
      g.rect(s.x - 16, s.y - 6, 32, 8).fill({ color: 0x4a7bd8 });
      return;
    }
    if (hero.state === "swing") {
      const p = hero.swingT / FEEL.attackTime;
      const color = hero.swingHit ? 0xffd04a : 0x8899ff;
      const alpha = hero.swingHit
        ? Math.max(0.15, 0.8 - (p - FEEL.hitFrac) * 2)
        : 0.15 + 0.4 * (p / FEEL.hitFrac);
      wedge(hero, hero.swingDir, FEEL.range + MON_R, 50, color, alpha);
    }
    const body =
      hero.flash > 0 && hc.flash === "tint"
        ? 0xff3030
        : hero.flash > 0
          ? 0xff7a7a
          : 0x4a7bd8;
    const tilt = hero.state === "flinch" ? -4 : 0;
    g.circle(s.x + tilt, s.y - 18, 10).fill({ color: body });
    g.circle(s.x + tilt, s.y - 32, 6).fill({ color: 0xe0c090 });
    g.moveTo(s.x, s.y - 4)
      .lineTo(
        s.x + Math.cos(hero.facing) * 22,
        s.y - 4 + Math.sin(hero.facing) * 22,
      )
      .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
  }

  function drawRing() {
    ring.clear();
    if (hc.life !== "ring" || hero.state === "dead") return;
    const s = project(hero.x, hero.y);
    const frac = Math.max(0, hero.life / cfg.heroLife);
    const pulse = inCombat ? 0.55 + 0.35 * Math.sin(now * 8) : 0.9;
    const color = frac < 0.3 ? 0xff2020 : inCombat ? 0xd83a3a : 0xc8b070;
    // iso ellipse track, then a filled arc for Life, starting at the back
    ring
      .ellipse(s.x, s.y, 22, 11)
      .stroke({ width: 4, color: 0x000000, alpha: 0.5 });
    const steps = 48;
    const from = -Math.PI / 2;
    ring.moveTo(s.x + Math.cos(from) * 22, s.y + Math.sin(from) * 11);
    for (let i = 1; i <= Math.round(steps * frac); i++) {
      const a = from + (i / steps) * Math.PI * 2;
      ring.lineTo(s.x + Math.cos(a) * 22, s.y + Math.sin(a) * 11);
    }
    ring.stroke({ width: 3, color, alpha: pulse });
    if (!inCombat && hero.life < cfg.heroLife) {
      // regeneration glint running round the ring
      const a = from + ((now * 2) % 1) * Math.PI * 2 * frac;
      ring
        .circle(s.x + Math.cos(a) * 22, s.y + Math.sin(a) * 11, 3)
        .fill({ color: 0x9cff9c });
    }
  }

  function drawOrb() {
    const W = app.screen.width;
    const H = app.screen.height;
    const r = 52;
    const cx = 24 + r + 10;
    const cy = H - 18 - r;
    // stone strip along the bottom, D1-style
    hud.rect(0, H - 34, W, 34).fill({ color: 0x15120e, alpha: 0.92 });
    hud.rect(0, H - 34, W, 2).fill({ color: 0x4a4236 });
    hud
      .circle(cx, cy, r + 8)
      .fill({ color: 0x2a241c })
      .stroke({ width: 2, color: 0x4a4236 });
    hud.circle(cx, cy, r).fill({ color: 0x140404 });
    const frac = Math.max(0, hero.life / cfg.heroLife);
    const top = cy + r - frac * r * 2;
    const wobble = inCombat ? 2.5 : 1;
    for (let y = Math.floor(top); y < cy + r; y += 1) {
      const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
      const wave = y < top + 3 ? Math.sin(now * 5 + y) * wobble : 0;
      const shade =
        0x8a0e0e +
        Math.min(0x30, Math.floor(((cy + r - y) / (r * 2)) * 0x30)) * 0x10000;
      hud.rect(cx - half + wave, y, half * 2, 1).fill({ color: shade });
    }
    if (!inCombat && hero.life < cfg.heroLife) {
      // regeneration: bubbles rising through the orb
      for (let i = 0; i < 6; i++) {
        const t = (now * 0.6 + i / 6) % 1;
        const y = cy + r - t * frac * r * 2;
        const x = cx + Math.sin(i * 2.3 + now * 2) * r * 0.5;
        hud.circle(x, y, 2).fill({ color: 0xff9a9a, alpha: 0.6 * (1 - t) });
      }
    }
    // glass highlight
    hud
      .ellipse(cx - r * 0.3, cy - r * 0.45, r * 0.35, r * 0.18)
      .fill({ color: 0xffffff, alpha: 0.12 });
    hud.circle(cx, cy, r).stroke({ width: 3, color: 0x6b6258 });
    badge.visible = true;
    badge.position.set(cx, cy - r - 12);
    badge.style.fill = inCombat ? 0xd84a3a : 0x9cd89c;
    badge.text =
      hero.state === "dead"
        ? ""
        : inCombat
          ? "⚔ In Combat"
          : hero.life < cfg.heroLife
            ? "+2 Life/s"
            : "";
  }

  function drawNameplate() {
    if (!hc.nameplate || !hoveredMonster || hc.layer !== "pixi") {
      plate.visible = false;
      return;
    }
    const W = app.screen.width;
    plate.visible = true;
    plate.text = "Skeleton";
    plate.position.set(W / 2, 16);
    const frac = hoveredMonster.life / cfg.monsterLife;
    hud.rect(W / 2 - 110, 10, 220, 46).fill({ color: 0x000000, alpha: 0.6 });
    hud.rect(W / 2 - 90, 38, 180, 8).fill({ color: 0x2a0606 });
    hud.rect(W / 2 - 90, 38, 180 * frac, 8).fill({ color: 0xa01818 });
  }

  function drawHud() {
    hud.clear();
    const W = app.screen.width;
    const H = app.screen.height;
    badge.visible = false;
    if (hc.layer === "pixi") {
      drawOrb();
      if (hero.flash > 0 && hc.flash === "fullscreen")
        hud
          .rect(0, 0, W, H)
          .fill({ color: 0xff0000, alpha: (hero.flash / 0.15) * 0.3 });
    }
    drawNameplate();
    // death
    world.filters = hc.death === "d2" && hero.state === "dead" ? [grey] : [];
    const showDeath = hc.layer === "pixi" && hero.state === "dead";
    banner.visible = hint.visible = showDeath && hero.t >= 1;
    if (showDeath) {
      hud
        .rect(0, 0, W, H)
        .fill({ color: 0x000000, alpha: Math.min(0.55, hero.t * 0.55) });
      banner.text = "You died";
      banner.position.set(W / 2, H / 2 - 30);
      hint.position.set(W / 2, H / 2 + 30);
      hint.alpha = 0.6 + 0.4 * Math.sin(now * 3);
    }
    // Esc menu with credits (Pixi variant)
    menuText.visible = pixiMenu;
    if (pixiMenu) {
      hud.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.6 });
      hud
        .rect(W / 2 - 230, H / 2 - 150, 460, 300)
        .fill({ color: 0x15120e })
        .stroke({ width: 2, color: 0x6b6258 });
      menuText.text = [
        "PAUSED",
        "",
        "Credits",
        "Art: Flare game assets — flareteam/flare-game",
        "by the Flare contributors, licensed CC-BY-SA 3.0",
        "Full list: /assets/CREDITS.txt",
        "",
        "Click or Esc to resume",
      ].join("\n");
      menuText.position.set(W / 2, H / 2);
    }
    if (fade > 0 && hc.layer === "pixi") {
      const a = fade > 0.3 ? (0.6 - fade) / 0.3 : fade / 0.3;
      hud.rect(0, 0, W, H).fill({ color: 0x000000, alpha: a });
    }
  }

  function render(dt: number) {
    now += dt;
    g.clear();
    hoveredMonster =
      ui.blocked() || hero.state === "dead" ? null : monsterUnderCursor();
    drawRing();
    const cw = cursorWorld();
    const ct = tileOf(cw);
    if (walk[ct.y]?.[ct.x]) drawDiamond(ct, 0xffffff, 0.25);
    if (marker) {
      marker.t -= dt;
      const m = project(marker.p.x, marker.p.y);
      g.ellipse(
        m.x,
        m.y,
        10 + (0.6 - marker.t) * 10,
        5 + (0.6 - marker.t) * 5,
      ).stroke({
        width: 2,
        color: 0x7cff7c,
        alpha: Math.max(0, marker.t / 0.6),
      });
      if (marker.t <= 0) marker = null;
    }

    type Drawable = { depth: number; draw: () => void };
    const items: Drawable[] = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (!walk[y][x])
          items.push({ depth: x + y + 1, draw: () => drawWall(x, y) });
    for (const m of monsters)
      items.push({
        depth: m.state === "dead" ? -1 : m.x + m.y,
        draw: () => drawMonster(m),
      });
    items.push({ depth: hero.x + hero.y, draw: drawHero });
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    for (const c of [...popups.children]) {
      const t = c as Popup;
      t.life -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (hc.numbers === "arc") t.vy += 420 * dt;
      t.alpha = Math.min(1, (t.life / t.max) * 2);
      if (t.life <= 0) {
        popups.removeChild(t);
        t.destroy();
      }
    }

    const hs = project(hero.x, hero.y);
    world.position.set(
      app.screen.width / 2 - hs.x,
      app.screen.height / 2 - hs.y,
    );
    drawHud();
  }

  const tick = () => {
    const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
    const paused = pixiMenu || ui.blocked();
    if (paused) {
      // menu / title card open: the world holds still
    } else if (hitstop > 0) hitstop -= dt;
    else step(dt);
    render(dt);
  };
  app.ticker.add(tick);

  return {
    snapshot(): MonsterSnapshot {
      const count = (st: MonState) =>
        monsters.filter((m) => m.state === st).length;
      return {
        hero: hero.state,
        life: `${Math.round(hero.life)} / ${cfg.heroLife}`,
        inCombat: inCombat
          ? chased
            ? "yes (chased)"
            : `yes (${(CALM_AFTER - sinceDamage).toFixed(1)} s)`
          : "no",
        deaths,
        kills,
        hitsTaken,
        monsters: `chasing ${count("chase") + count("windup") + count("recover")} · dead ${count("dead")} / ${monsters.length}`,
      };
    },
    view(): HudView {
      return {
        life: hero.life,
        maxLife: cfg.heroLife,
        inCombat,
        calmIn: chased ? null : Math.max(0, CALM_AFTER - sinceDamage),
        regenerating:
          !inCombat && hero.state !== "dead" && hero.life < cfg.heroLife,
        flash: hero.flash / 0.15,
        dead: hero.state === "dead",
        deadT: hero.state === "dead" ? hero.t : 0,
        fade: fade > 0.3 ? (0.6 - fade) / 0.3 : fade / 0.3,
        hovered: hoveredMonster
          ? {
              name: "Skeleton",
              life: hoveredMonster.life,
              maxLife: cfg.monsterLife,
            }
          : null,
        bars: monsters.filter(alive).map((m) => {
          const p = world.toGlobal(project(m.x, m.y));
          return {
            id: m.id,
            x: p.x,
            y: p.y - 52,
            life: m.life,
            maxLife: cfg.monsterLife,
            hovered: m === hoveredMonster,
          };
        }),
      };
    },
    stop() {
      app.ticker.remove(tick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      app.canvas.removeEventListener("contextmenu", noMenu);
    },
  };
}
