"use client";

// PROTOTYPE (throwaway) for T265. ?variant=A|B|C and ?area=catacombs|town.
// Click: move the Hero. Tab: toggle the Map Overlay. E: explore all.
// The World underneath is a stand-in drawn from the same Area (floor, wall
// blocks, a few Monsters); the maps use the game's own iso projection.

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { areaDisplayNames, areas, tilesets } from "@/game/content";
import { TILE_HEIGHT, TILE_WIDTH, toScreen, toTile } from "@/game/iso";
import { type Area, loadArea } from "@/game/sim/area";
import {
  type Look,
  LOOK_KEYS,
  LOOKS,
  type LookKey,
  OVERLAY_SCALE,
} from "./variants";

type Pt = { x: number; y: number };
type Seg = { a: Pt; b: Pt; kind: "wall" | "floor"; tile: Pt };

const EXPLORE_RADIUS = 12; // tiles; "about a screen wide"

function buildSegments(area: Area): Seg[] {
  const segs: Seg[] = [];
  const { width: w, height: h } = area;
  const at = (g: boolean[], x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? g[y * w + x] : false;
  const edges: [Pt, Pt, number, number][] = [
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, 0, -1],
    [{ x: 1, y: 0 }, { x: 1, y: 1 }, 1, 0],
    [{ x: 1, y: 1 }, { x: 0, y: 1 }, 0, 1],
    [{ x: 0, y: 1 }, { x: 0, y: 0 }, -1, 0],
  ];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(area.walkable, x, y)) continue;
      for (const [a, b, dx, dy] of edges) {
        if (at(area.walkable, x + dx, y + dy)) continue;
        // Walkable meets a wall: a wall line; meets bare void: a floor line.
        const kind = at(area.floor, x + dx, y + dy) ? "wall" : "floor";
        segs.push({
          a: { x: x + a.x, y: y + a.y },
          b: { x: x + b.x, y: y + b.y },
          kind,
          tile: { x, y },
        });
      }
    }
  return segs;
}

function hash(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function tilePath(c: CanvasRenderingContext2D, t: Pt, lift = 0) {
  const p = [
    toScreen(t),
    toScreen({ x: t.x + 1, y: t.y }),
    toScreen({ x: t.x + 1, y: t.y + 1 }),
    toScreen({ x: t.x, y: t.y + 1 }),
  ];
  c.beginPath();
  p.forEach((q, i) => {
    if (i) c.lineTo(q.x, q.y - lift);
    else c.moveTo(q.x, q.y - lift);
  });
  c.closePath();
}

export function MapLookPrototype() {
  const params = useSearchParams();
  const raw = params.get("variant") ?? "A";
  const key: LookKey = (LOOK_KEYS as string[]).includes(raw)
    ? (raw as LookKey)
    : "A";
  const look: Look = LOOKS[key];
  const areaName = params.get("area") === "town" ? "town" : "catacombs";
  const area = useMemo(
    () => loadArea(areaName, areas[areaName], tilesets),
    [areaName],
  );
  const segs = useMemo(() => buildSegments(area), [area]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState(true);
  const [exploreAll, setExploreAll] = useState(true);
  const [hero, setHero] = useState<Pt>(
    () => area.entries["from-town"] ?? area.entries.start,
  );
  const [facing, setFacing] = useState(0.8);
  const [size, setSize] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    setHero(area.entries["from-town"] ?? area.entries.start);
    setExploreAll(true);
  }, [area]);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setOverlay((o) => !o);
      }
      if (e.key === "e") setExploreAll((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const minions = useMemo<Pt[]>(
    () => [
      { x: hero.x - 1.2, y: hero.y + 0.6 },
      { x: hero.x + 0.5, y: hero.y + 1.4 },
      { x: hero.x - 0.4, y: hero.y - 1.3 },
    ],
    [hero],
  );
  // The Town Portal's Combat Area end is a stand-in near the Hero.
  const portal: Pt = area.townPortal ?? { x: hero.x + 2.5, y: hero.y - 1.5 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const heroS = toScreen(hero);
    const explored = (t: Pt) =>
      exploreAll ||
      Math.hypot(t.x + 0.5 - hero.x, t.y + 0.5 - hero.y) <= EXPLORE_RADIUS;

    // ---- the World stand-in
    ctx.fillStyle = "#07060a";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(size.w / 2 - heroS.x, size.h / 2 - heroS.y);
    const hx = Math.round(hero.x);
    const hy = Math.round(hero.y);
    const span = Math.ceil(size.w / TILE_WIDTH + size.h / TILE_HEIGHT) + 4;
    const grass = areaName === "town";
    for (let s = hx + hy - span; s <= hx + hy + span; s++)
      for (let x = hx - span; x <= hx + span; x++) {
        const y = s - x;
        if (x < 0 || y < 0 || x >= area.width || y >= area.height) continue;
        const i = y * area.width + x;
        if (!area.floor[i]) continue;
        const v = hash(x, y);
        ctx.fillStyle = grass
          ? `hsl(${95 + v * 15} 25% ${20 + v * 7}%)`
          : `hsl(${28 + v * 10} 10% ${16 + v * 7}%)`;
        tilePath(ctx, { x, y });
        ctx.fill();
        if (!area.walkable[i]) {
          const hgt = 110;
          ctx.fillStyle = grass ? "#3a2f26" : "#2b2730";
          tilePath(ctx, { x, y }, hgt);
          ctx.fill();
          const a = toScreen({ x, y: y + 1 });
          const b = toScreen({ x: x + 1, y: y + 1 });
          const c2 = toScreen({ x: x + 1, y });
          ctx.fillStyle = grass ? "#2a2119" : "#1d1a22";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(b.x, b.y - hgt);
          ctx.lineTo(a.x, a.y - hgt);
          ctx.fill();
          ctx.fillStyle = grass ? "#33281f" : "#25222b";
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.lineTo(c2.x, c2.y - hgt);
          ctx.lineTo(b.x, b.y - hgt);
          ctx.fill();
        }
      }
    const blob = (t: Pt, color: string, r: number) => {
      const p = toScreen(t);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - r, r * 0.7, r * 1.4, 0, 0, 7);
      ctx.fill();
    };
    if (!grass) {
      for (const [dx, dy] of [[3, 1.5], [3.8, 3.2], [6.5, 6], [8, 4.5], [10, 7.5]])
        blob({ x: hero.x + dx, y: hero.y + dy }, "#c9c2a8", 26);
      blob({ x: hero.x + 2.2, y: hero.y - 0.4 }, "#e0a030", 8);
    }
    blob(hero, "#8aa0c8", 34);
    for (const m of minions) blob(m, "#58a058", 22);
    ctx.restore();

    // ---- a map layer: edges and marks, centred on the Hero
    const layer = (w: number, h: number, scale: number, full: boolean) => {
      const off = document.createElement("canvas");
      off.width = w * dpr;
      off.height = h * dpr;
      const c = off.getContext("2d") as CanvasRenderingContext2D;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = w / 2;
      const cy = h / 2;
      const visible = (p: Pt) =>
        Math.abs((p.x - heroS.x) * scale) < w / 2 + 40 &&
        Math.abs((p.y - heroS.y) * scale) < h / 2 + 40;
      c.save();
      c.translate(cx, cy);
      c.scale(scale, scale);
      c.translate(-heroS.x, -heroS.y);
      c.lineCap = "round";
      c.lineJoin = "round";
      if (look.fill.alpha > 0) {
        c.fillStyle = look.fill.color;
        c.globalAlpha = look.fill.alpha;
        for (let y = 0; y < area.height; y++)
          for (let x = 0; x < area.width; x++) {
            if (!area.walkable[y * area.width + x] || !explored({ x, y }))
              continue;
            if (!visible(toScreen({ x, y }))) continue;
            tilePath(c, { x, y });
            c.fill();
          }
        c.globalAlpha = 1;
      }
      for (const kind of ["floor", "wall"] as const) {
        const st = look[kind];
        c.strokeStyle = st.color;
        c.lineWidth = st.width / scale;
        c.beginPath();
        for (const s of segs) {
          if (s.kind !== kind || !explored(s.tile)) continue;
          const a = toScreen(s.a);
          if (!visible(a)) continue;
          const b = toScreen(s.b);
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
        }
        c.stroke();
      }
      c.restore();
      // marks are drawn at unscaled size
      const at = (t: Pt, fn: (x: number, y: number) => void) => {
        const p = toScreen(t);
        fn(cx + (p.x - heroS.x) * scale, cy + (p.y - heroS.y) * scale);
      };
      for (const ex of area.exits) {
        const t = { x: ex.x + ex.width / 2, y: ex.y + ex.height / 2 };
        if (!explored({ x: Math.floor(t.x), y: Math.floor(t.y) })) continue;
        at(t, (x, y) => {
          drawExit(c, look, x, y);
          if (full)
            label(
              c,
              areaDisplayNames[ex.area] ?? ex.area,
              x,
              y - look.exit.size - 4,
              look.exit.labelFont,
              look.exit.label,
              look.npc.outline ?? "#000",
            );
        });
      }
      at(portal, (x, y) => drawPortal(c, look, x, y));
      if (grass)
        for (const n of area.npcs)
          at(n.pos, (x, y) => {
            c.fillStyle = look.npc.color;
            c.beginPath();
            c.arc(x, y, 2, 0, 7);
            c.fill();
            if (full)
              label(c, n.name, x, y - 5, look.npc.font, look.npc.color, look.npc.outline);
          });
      for (const m of minions) at(m, (x, y) => drawMinion(c, look, x, y));
      at(hero, (x, y) => drawHero(c, look, x, y, facing));
      return off;
    };

    if (overlay) {
      ctx.globalAlpha = look.overlayOpacity;
      ctx.drawImage(layer(size.w, size.h, OVERLAY_SCALE, true), 0, 0, size.w, size.h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = look.exit.label;
      ctx.font = look.exit.labelFont.replace("12px", "16px");
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(areaDisplayNames[areaName], size.w - 20, 12);
    }

    // ---- the Mini Map, top right (the prototype shows it with the overlay too)
    const m = look.mini;
    const ms = m.size;
    const mx = size.w - ms - m.margin;
    const my = m.margin + (overlay ? 28 : 0);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mx, my, ms, ms, m.radius);
    ctx.fillStyle = m.bg;
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = m.opacity;
    ctx.drawImage(layer(ms, ms, m.scale, false), mx, my, ms, ms);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(mx, my, ms, ms, m.radius);
    ctx.strokeStyle = m.border.outer;
    ctx.lineWidth = m.border.outerWidth;
    ctx.stroke();
    if (m.border.inner) {
      const inset = m.border.outerWidth / 2 + m.border.innerWidth / 2;
      ctx.beginPath();
      ctx.roundRect(mx + inset, my + inset, ms - inset * 2, ms - inset * 2, Math.max(0, m.radius - 2));
      ctx.strokeStyle = m.border.inner;
      ctx.lineWidth = m.border.innerWidth;
      ctx.stroke();
    }
    if (m.studs) {
      ctx.fillStyle = m.studs;
      for (const [sx, sy] of [[mx, my], [mx + ms, my], [mx, my + ms], [mx + ms, my + ms]]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, 7);
        ctx.fill();
      }
    }
  }, [look, area, areaName, segs, hero, facing, minions, portal, overlay, exploreAll, size]);

  const onClick = (e: React.MouseEvent) => {
    const heroS = toScreen(hero);
    const t = toTile({
      x: heroS.x + e.clientX - size.w / 2,
      y: heroS.y + e.clientY - size.h / 2,
    });
    if (!area.walkable[Math.floor(t.y) * area.width + Math.floor(t.x)]) return;
    setFacing(Math.atan2(t.y - hero.y, t.x - hero.x));
    setHero(t);
  };

  const other = areaName === "town" ? "catacombs" : "town";
  return (
    <>
      <canvas
        ref={canvasRef}
        onClick={onClick}
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", display: "block" }}
      />
      <div
        style={{
          position: "fixed", left: 12, top: 12, padding: "8px 10px",
          background: "rgba(0,0,0,.6)", color: "#ddd", font: "12px/1.5 system-ui",
          borderRadius: 6, maxWidth: 360,
        }}
      >
        <b>{key}: {look.label}</b> · {areaName} ·{" "}
        <a style={{ color: "#8cf" }} href={`?variant=${key}&area=${other}`}>
          switch to {other}
        </a>
        <br />
        wall {look.wall.color} {look.wall.width}px · floor {look.floor.color} {look.floor.width}px · overlay{" "}
        {Math.round(look.overlayOpacity * 100)}%
        <br />
        <span style={{ opacity: 0.7 }}>click: move Hero · Tab: overlay · E: explore all · arrows: variant</span>
      </div>
      <PrototypeSwitcher
        variants={LOOK_KEYS}
        labels={Object.fromEntries(LOOK_KEYS.map((k) => [k, LOOKS[k].label]))}
      />
    </>
  );
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, outline: string | null) {
  c.font = font;
  c.textAlign = "center";
  c.textBaseline = "bottom";
  if (outline) {
    c.lineWidth = 3;
    c.strokeStyle = outline;
    c.lineJoin = "round";
    c.strokeText(text, x, y);
  }
  c.fillStyle = color;
  c.fillText(text, x, y);
}

function drawHero(c: CanvasRenderingContext2D, look: Look, x: number, y: number, facing: number) {
  const { mark, color, size: s } = look.hero;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2;
  if (mark === "cross") {
    c.beginPath();
    c.moveTo(x - s, y); c.lineTo(x + s, y);
    c.moveTo(x, y - s); c.lineTo(x, y + s);
    c.stroke();
  } else if (mark === "arrow") {
    const dx = ((Math.cos(facing) - Math.sin(facing)) * TILE_WIDTH) / 2;
    const dy = ((Math.cos(facing) + Math.sin(facing)) * TILE_HEIGHT) / 2;
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(dy, dx));
    c.beginPath();
    c.moveTo(s, 0); c.lineTo(-s * 0.7, s * 0.7); c.lineTo(-s * 0.3, 0); c.lineTo(-s * 0.7, -s * 0.7);
    c.closePath();
    c.fill();
    c.strokeStyle = "#000";
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  } else {
    c.beginPath(); c.arc(x, y, s, 0, 7); c.stroke();
    c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill();
  }
}

function drawMinion(c: CanvasRenderingContext2D, look: Look, x: number, y: number) {
  const { mark, color, size: s } = look.minion;
  c.fillStyle = color;
  if (mark === "dot") {
    c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
  } else if (mark === "square") {
    c.fillRect(x - s, y - s, s * 2, s * 2);
  } else {
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.8); c.lineTo(x - s, y + s * 0.8);
    c.closePath();
    c.fill();
  }
}

function drawExit(c: CanvasRenderingContext2D, look: Look, x: number, y: number) {
  const { mark, color, size: s } = look.exit;
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = 2;
  if (mark === "diamond") {
    c.beginPath();
    c.moveTo(x, y - s * 0.6); c.lineTo(x + s, y); c.lineTo(x, y + s * 0.6); c.lineTo(x - s, y);
    c.closePath();
    c.fill();
  } else if (mark === "chevron") {
    c.beginPath(); c.moveTo(x - s, y - s * 0.3); c.lineTo(x, y + s * 0.5); c.lineTo(x + s, y - s * 0.3); c.stroke();
    c.beginPath(); c.moveTo(x - s, y - s * 0.9); c.lineTo(x, y - s * 0.1); c.lineTo(x + s, y - s * 0.9); c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x - s * 0.7, y + s * 0.7);
    c.lineTo(x - s * 0.7, y - s * 0.3);
    c.arc(x, y - s * 0.3, s * 0.7, Math.PI, 0);
    c.lineTo(x + s * 0.7, y + s * 0.7);
    c.closePath();
    c.fill();
    c.fillStyle = "#1a0a04";
    c.beginPath();
    c.moveTo(x - s * 0.3, y + s * 0.7);
    c.lineTo(x - s * 0.3, y - s * 0.2);
    c.arc(x, y - s * 0.2, s * 0.3, Math.PI, 0);
    c.lineTo(x + s * 0.3, y + s * 0.7);
    c.fill();
  }
}

function drawPortal(c: CanvasRenderingContext2D, look: Look, x: number, y: number) {
  const { mark, color, size: s } = look.portal;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2;
  if (mark === "ring") {
    c.beginPath(); c.ellipse(x, y, s, s * 0.6, 0, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(x, y, s * 0.4, s * 0.25, 0, 0, 7); c.fill();
  } else if (mark === "swirl") {
    c.beginPath();
    for (let a = 0; a < 12; a += 0.3) {
      const r = (a / 12) * s;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.65;
      if (a) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x + s * 0.8, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.8, y);
    c.closePath();
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 1;
    c.stroke();
  }
}
