// PROTOTYPE (throwaway): isometric click-to-move + melee sandbox for ticket #77.
// No tests, no abstractions. Everything is drawn with Graphics, redrawn every frame.

import {
  type Application,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Text,
} from "pixi.js";
import type { FeelConfig } from "./variants";

const TW = 64; // tile width in px
const TH = 32; // tile height in px
const WALL_H = 26;
const SIZE = 22;
const HERO_R = 0.3;
const DAMAGE = 25;
const DUMMY_LIFE = 100;

type Vec = { x: number; y: number };
type Dummy = {
  id: number;
  home: Vec;
  x: number;
  y: number;
  life: number;
  flash: number;
  sinceHit: number;
  dead: number;
  kb: Vec; // knockback velocity, tiles/s
  kbT: number;
};
type Action =
  | { kind: "move"; to: Vec }
  | { kind: "attack"; target: Dummy }
  | { kind: "inPlace"; to: Vec };
type HeroState = "idle" | "moving" | "approach" | "swing";

export type FeelSnapshot = {
  state: HeroState;
  pos: string;
  tile: string;
  facingDeg: number;
  pathLeft: number;
  queued: string;
  held: string;
  swing: string;
  dummies: string;
  hits: number;
  lastHit: string;
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
    [6, 4, 6, 9], // x0,y0,x1,y1 inclusive
    [10, 12, 16, 12],
    [14, 4, 15, 5],
    [4, 15, 5, 18],
  ];
  for (const [x0, y0, x1, y1] of walls)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) walk[y][x] = false;
  return walk;
}

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
const snap8 = (a: number) => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
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

function lineOfSight(walk: boolean[][], a: Vec, b: Vec) {
  const d = dist(a, b);
  const steps = Math.ceil(d / 0.1);
  const px = d ? (-(b.y - a.y) / d) * HERO_R : 0;
  const py = d ? ((b.x - a.x) / d) * HERO_R : 0;
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

// --- game -----------------------------------------------------------------

export function startFeelGame(app: Application, cfg: FeelConfig) {
  const walk = makeGrid();
  const world = new Container();
  const floor = new Graphics();
  const g = new Graphics();
  const popups = new Container();
  world.addChild(floor, g, popups);
  app.stage.addChild(world);

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
      floor
        .poly(pts.flatMap((p) => [p.x, p.y]))
        .fill({ color: (x + y) % 2 ? 0x2a2a30 : 0x24242a })
        .stroke({ width: 1, color: 0x34343c });
    }

  const hero = {
    x: 3.5,
    y: 3.5,
    facing: screenAngle(1, 1),
    state: "idle" as HeroState,
    path: [] as Vec[],
    target: null as Dummy | null,
    swingT: 0,
    swingHit: false,
    swingDir: 0,
    repathT: 0,
    queued: null as Action | null,
  };
  const dummies: Dummy[] = [
    { x: 9.5, y: 7.5 },
    { x: 12.5, y: 9.5 },
    { x: 9.5, y: 16.5 },
    { x: 17.5, y: 15.5 },
  ].map((p, id) => ({
    id,
    home: { ...p },
    ...p,
    life: DUMMY_LIFE,
    flash: 0,
    sinceHit: 99,
    dead: 0,
    kb: { x: 0, y: 0 },
    kbT: 0,
  }));

  const input = {
    screen: { x: 0, y: 0 },
    held: false,
    shift: false,
    heldKind: null as Action["kind"] | null,
    heldTarget: null as Dummy | null,
    reissueT: 0,
  };
  let marker: { p: Vec; t: number } | null = null;
  let hitstop = 0;
  let shakeT = 0;
  let hits = 0;
  let lastHit = "-";

  const cursorWorld = () => {
    const local = world.toLocal(input.screen);
    return unproject(local.x, local.y);
  };
  const dummyUnderCursor = () => {
    const local = world.toLocal(input.screen);
    let best: Dummy | null = null;
    let bestD = 24;
    for (const d of dummies) {
      if (d.dead > 0) continue;
      const s = project(d.x, d.y);
      const dd = Math.hypot(local.x - s.x, local.y - (s.y - 18));
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    return best;
  };
  const face = (a: number) => (cfg.facing === "8" ? snap8(a) : a);

  // --- orders ---

  function planPath(to: Vec): Vec[] | null {
    if (cfg.moveMode === "tile") {
      // Finish the step in progress, then re-plan from the tile we're heading to.
      const stepping = hero.path.length > 0 && hero.state !== "swing";
      const startTile = stepping ? tileOf(hero.path[0]) : tileOf(hero);
      const tiles = astar(walk, startTile, tileOf(to));
      if (!tiles) return null;
      const pts = tiles.map(centre);
      return stepping ? [hero.path[0], ...pts.slice(1)] : pts.slice(1);
    }
    const tiles = astar(walk, tileOf(hero), tileOf(to));
    if (!tiles) return null;
    const pts = tiles.slice(1).map(centre);
    if (!pts.length) pts.push(to);
    else pts[pts.length - 1] = to;
    // String pulling: skip ahead to the farthest point in straight sight.
    const out: Vec[] = [];
    let from: Vec = hero;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !lineOfSight(walk, from, pts[j])) j--;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  }

  function startSwing(dir: number, target: Dummy | null) {
    hero.state = "swing";
    hero.swingT = 0;
    hero.swingHit = false;
    hero.swingDir = face(dir);
    hero.facing = hero.swingDir;
    hero.target = target;
    hero.path = [];
  }

  function execute(a: Action) {
    if (a.kind === "move") {
      const p = planPath(a.to);
      marker = { p: a.to, t: 0.6 };
      if (!p) return;
      hero.path = p;
      hero.target = null;
      hero.state = p.length ? "moving" : "idle";
    } else if (a.kind === "attack") {
      hero.target = a.target;
      // tile mode never swings mid-step: finish the step first (approach waits for the centre)
      const midStep = cfg.moveMode === "tile" && hero.path.length > 0;
      if (inRange(a.target) && !midStep)
        startSwing(
          screenAngle(a.target.x - hero.x, a.target.y - hero.y),
          a.target,
        );
      else {
        hero.state = "approach";
        hero.path = planPath(a.target) ?? [];
        hero.repathT = 0.3;
      }
    } else {
      startSwing(screenAngle(a.to.x - hero.x, a.to.y - hero.y), null);
    }
  }

  function order(a: Action) {
    if (hero.state === "swing") {
      if (cfg.cancelAfterHit && hero.swingHit && a.kind === "move")
        return execute(a);
      if (cfg.buffer) hero.queued = a;
      return;
    }
    execute(a);
  }

  const inRange = (d: Dummy) =>
    d.dead <= 0 &&
    dist(hero, d) <= cfg.range + (cfg.moveMode === "tile" ? 0.01 : 0);

  function actionAtCursor(): Action {
    const d = dummyUnderCursor();
    if (d) return { kind: "attack", target: d };
    if (input.shift) return { kind: "inPlace", to: cursorWorld() };
    return { kind: "move", to: cursorWorld() };
  }

  // --- input ---

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  const onDown = (e: FederatedPointerEvent) => {
    if (e.button !== 0) return;
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
  };
  const noMenu = (e: MouseEvent) => e.preventDefault();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  app.canvas.addEventListener("contextmenu", noMenu);

  // --- simulation ---

  function hit(d: Dummy) {
    d.life -= DAMAGE;
    d.flash = 0.12;
    d.sinceHit = 0;
    hits++;
    lastHit = `t=${(hero.swingT * 1000).toFixed(0)}ms of ${(cfg.attackTime * 1000).toFixed(0)}ms`;
    if (cfg.knockback > 0) {
      const dd = dist(hero, d) || 1;
      const kbTime = 0.12;
      d.kb = {
        x: ((d.x - hero.x) / dd) * (cfg.knockback / kbTime),
        y: ((d.y - hero.y) / dd) * (cfg.knockback / kbTime),
      };
      d.kbT = kbTime;
    }
    hitstop = cfg.hitstopMs / 1000;
    shakeT = cfg.shake > 0 ? 0.15 : 0;
    const s = project(d.x, d.y);
    const t = new Text({
      text: d.life <= 0 ? "KILL" : `${DAMAGE}`,
      style: {
        fill: d.life <= 0 ? 0xffd04a : 0xffffff,
        fontSize: 14,
        fontWeight: "bold",
      },
    });
    t.anchor.set(0.5);
    t.position.set(s.x, s.y - 44);
    (t as Text & { life?: number }).life = 0.7;
    popups.addChild(t);
    if (d.life <= 0) {
      d.dead = 2;
      d.life = 0;
    }
  }

  function endSwing() {
    hero.state = "idle";
    const q = hero.queued;
    hero.queued = null;
    if (q) return execute(q);
    if (!input.held) return;
    if (input.heldKind === "attack" && cfg.repeatWhileHeld) {
      const t = input.heldTarget;
      if (t && t.dead <= 0) execute({ kind: "attack", target: t });
    } else if (input.heldKind === "inPlace" && cfg.repeatWhileHeld) {
      execute({ kind: "inPlace", to: cursorWorld() });
    } else if (input.heldKind === "move" && cfg.input === "hold") {
      execute({ kind: "move", to: cursorWorld() });
    }
  }

  function step(dt: number) {
    // hold-to-steer
    const canSteer =
      hero.state !== "swing" || (cfg.cancelAfterHit && hero.swingHit);
    if (
      input.held &&
      cfg.input === "hold" &&
      input.heldKind === "move" &&
      canSteer
    ) {
      input.reissueT -= dt;
      if (input.reissueT <= 0) {
        input.reissueT = 0.12;
        const d = dummyUnderCursor();
        if (d) {
          input.heldKind = "attack";
          input.heldTarget = d;
          order({ kind: "attack", target: d });
        } else order({ kind: "move", to: cursorWorld() });
      }
    }

    if (hero.state === "approach" && hero.target) {
      const t = hero.target;
      if (t.dead > 0) {
        hero.state = "idle";
        hero.path = [];
      } else {
        hero.repathT -= dt;
        const atCentre =
          cfg.moveMode !== "tile" ||
          hero.path.length === 0 ||
          dist(hero, hero.path[0]) < 0.01;
        if (inRange(t) && atCentre)
          startSwing(screenAngle(t.x - hero.x, t.y - hero.y), t);
        else if (hero.repathT <= 0) {
          hero.repathT = 0.3;
          hero.path = planPath(t) ?? hero.path;
        }
      }
    }

    if (
      (hero.state === "moving" || hero.state === "approach") &&
      hero.path.length
    ) {
      let budget = cfg.speed * dt;
      while (budget > 0 && hero.path.length) {
        const n = hero.path[0];
        const d = dist(hero, n);
        if (d > 0.0001)
          hero.facing = face(screenAngle(n.x - hero.x, n.y - hero.y));
        if (d <= budget) {
          hero.x = n.x;
          hero.y = n.y;
          hero.path.shift();
          budget -= d;
          // tile mode: re-check range at each tile centre while approaching
          if (
            hero.state === "approach" &&
            hero.target &&
            cfg.moveMode === "tile" &&
            inRange(hero.target)
          ) {
            hero.path = [];
            break;
          }
          if (
            hero.state === "approach" &&
            cfg.moveMode === "free" &&
            hero.target &&
            inRange(hero.target)
          ) {
            hero.path = [];
            break;
          }
        } else {
          hero.x += ((n.x - hero.x) / d) * budget;
          hero.y += ((n.y - hero.y) / d) * budget;
          budget = 0;
          if (
            hero.state === "approach" &&
            cfg.moveMode === "free" &&
            hero.target &&
            inRange(hero.target)
          ) {
            hero.path = [];
          }
        }
      }
      if (!hero.path.length && hero.state === "moving") hero.state = "idle";
    }

    if (hero.state === "swing") {
      hero.swingT += dt;
      if (!hero.swingHit && hero.swingT >= cfg.hitFrac * cfg.attackTime) {
        hero.swingHit = true;
        const victims = dummies.filter((d) => {
          if (d.dead > 0) return false;
          if (hero.target)
            return d === hero.target && dist(hero, d) <= cfg.range + 0.3;
          return (
            dist(hero, d) <= cfg.range &&
            angleDiff(screenAngle(d.x - hero.x, d.y - hero.y), hero.swingDir) <
              (50 * Math.PI) / 180
          );
        });
        for (const v of victims) hit(v);
      }
      if (hero.swingT >= cfg.attackTime) endSwing();
    }

    for (const d of dummies) {
      d.flash = Math.max(0, d.flash - dt);
      d.sinceHit += dt;
      if (d.kbT > 0) {
        d.kbT -= dt;
        const nx = d.x + d.kb.x * dt;
        const ny = d.y + d.kb.y * dt;
        if (walk[Math.floor(ny)]?.[Math.floor(nx)]) {
          d.x = nx;
          d.y = ny;
        }
      }
      if (d.dead > 0) {
        d.dead -= dt;
        if (d.dead <= 0)
          Object.assign(d, { ...d.home, life: DUMMY_LIFE, dead: 0 });
      } else if (d.sinceHit > 3 && d.life < DUMMY_LIFE) {
        d.life = DUMMY_LIFE;
        Object.assign(d, d.home);
      }
    }
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

  function drawDummy(d: Dummy) {
    const s = project(d.x, d.y);
    g.ellipse(s.x, s.y, 14, 7).fill({ color: 0x000000, alpha: 0.35 });
    if (d.dead > 0) {
      g.rect(s.x - 16, s.y - 6, 32, 8).fill({ color: 0x555555 });
      return;
    }
    const col = d.flash > 0 ? 0xffffff : 0x9c3b2c;
    g.rect(s.x - 9, s.y - 34, 18, 32).fill({ color: col });
    g.rect(s.x - 16, s.y - 30, 32, 5).fill({ color: col });
    if (d === dummyUnderCursor())
      g.rect(s.x - 11, s.y - 36, 22, 36).stroke({ width: 2, color: 0xffd04a });
    g.rect(s.x - 16, s.y - 44, 32, 4).fill({ color: 0x330000 });
    g.rect(s.x - 16, s.y - 44, (32 * d.life) / DUMMY_LIFE, 4).fill({
      color: 0xd83a3a,
    });
  }

  function drawHero() {
    const s = project(hero.x, hero.y);
    g.ellipse(s.x, s.y, 12, 6).fill({ color: 0x000000, alpha: 0.35 });
    if (hero.state === "swing") {
      const r = (cfg.range * TW) / 2;
      const p = hero.swingT / cfg.attackTime;
      const color = hero.swingHit ? 0xffd04a : 0x8899ff;
      const alpha = hero.swingHit
        ? Math.max(0.15, 0.8 - (p - cfg.hitFrac) * 2)
        : 0.15 + 0.4 * (p / cfg.hitFrac);
      const half = (50 * Math.PI) / 180;
      g.moveTo(s.x, s.y)
        .arc(s.x, s.y, r, hero.swingDir - half, hero.swingDir + half)
        .closePath()
        .fill({ color, alpha });
    }
    g.circle(s.x, s.y - 18, 10).fill({ color: 0x4a7bd8 });
    g.circle(s.x, s.y - 32, 6).fill({ color: 0xe0c090 });
    g.moveTo(s.x, s.y - 4)
      .lineTo(
        s.x + Math.cos(hero.facing) * 22,
        s.y - 4 + Math.sin(hero.facing) * 22,
      )
      .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
  }

  function render(dt: number) {
    g.clear();
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
    if (hero.path.length) {
      let prev = project(hero.x, hero.y);
      for (const p of hero.path) {
        const s = project(p.x, p.y);
        g.moveTo(prev.x, prev.y)
          .lineTo(s.x, s.y)
          .stroke({ width: 1, color: 0x7cff7c, alpha: 0.35 });
        prev = s;
      }
    }

    type Drawable = { depth: number; draw: () => void };
    const items: Drawable[] = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (!walk[y][x])
          items.push({ depth: x + y + 1, draw: () => drawWall(x, y) });
    for (const d of dummies)
      items.push({ depth: d.x + d.y, draw: () => drawDummy(d) });
    items.push({ depth: hero.x + hero.y, draw: drawHero });
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    for (const c of [...popups.children]) {
      const t = c as Text & { life?: number };
      t.life = (t.life ?? 0) - dt;
      t.y -= 30 * dt;
      t.alpha = Math.max(0, (t.life ?? 0) / 0.7);
      if ((t.life ?? 0) <= 0) {
        popups.removeChild(t);
        t.destroy();
      }
    }

    const hs = project(hero.x, hero.y);
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      shakeT -= dt;
      sx = (Math.random() - 0.5) * 2 * cfg.shake;
      sy = (Math.random() - 0.5) * 2 * cfg.shake;
    }
    world.position.set(
      app.screen.width / 2 - hs.x + sx,
      app.screen.height / 2 - hs.y + sy,
    );
  }

  const tick = () => {
    const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
    if (hitstop > 0) hitstop -= dt;
    else step(dt);
    render(dt);
  };
  app.ticker.add(tick);

  return {
    snapshot(): FeelSnapshot {
      const t = tileOf(hero);
      return {
        state: hero.state,
        pos: `${hero.x.toFixed(2)}, ${hero.y.toFixed(2)}`,
        tile: `${t.x}, ${t.y}`,
        facingDeg: Math.round((hero.facing * 180) / Math.PI),
        pathLeft: hero.path.length,
        queued: hero.queued ? hero.queued.kind : "-",
        held: input.held ? (input.heldKind ?? "?") : "-",
        swing:
          hero.state === "swing"
            ? `${(hero.swingT * 1000).toFixed(0)}/${(cfg.attackTime * 1000).toFixed(0)}ms ${hero.swingHit ? "(hit landed)" : "(wind-up)"}`
            : "-",
        dummies: dummies.map((d) => (d.dead > 0 ? "dead" : d.life)).join(" / "),
        hits,
        lastHit,
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
