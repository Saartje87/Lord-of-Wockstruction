import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from "three";
import { CORPSE_BURST } from "../render/corpseBurst";
import { CURSE_CIRCLE } from "../render/curse";
import { LEVEL_UP } from "../render/levelUp";
import { TELEGRAPH } from "../render/telegraph";
import type { FloorEffectsView } from "./view";

/**
 * How many of each effect can show at once. The meshes are made once and
 * only shown, moved and faded, so no shader ever recompiles.
 */
const POOL = { telegraphs: 10, curses: 4, bursts: 6, marks: 8, burns: 6 };

/** The mark of Muck on the ground: a murky green, filling as the Muck nears. */
const MUCK_MARK = {
  colour: 0x8fc22e,
  fillAlpha: 0.12,
  filledAlpha: 0.4,
  edgeAlpha: 0.8,
};

/** The colour of a landing mark by what was lobbed: Gravefire's is fire. */
const MARK_COLOURS: Partial<Record<string, number>> = { gravefire: 0xff6a1a };

/** A burning circle on the ground: a fire disc, brightest at its rim. */
const BURN = { colour: 0xff6a1a, fillAlpha: 0.35, edgeAlpha: 0.9 };

/** How high the effects lie, over the Exit pool's glow (0.12) on the floor. */
const LIFT = 0.14;

/** How many segments a telegraph wedge is cut into. */
const WEDGE_SEGMENTS = 24;

/** How thick a ring is, as a share of its radius. */
const RING_THICKNESS = 0.1;

/** A flat, unlit, see-through glow that doesn't write depth or take fog. */
function glow(colour: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: colour,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: DoubleSide,
  });
}

/** A disc of radius 1 lying on the floor. */
function disc(material: MeshBasicMaterial): Mesh {
  const mesh = new Mesh(new CircleGeometry(1, 40), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** A ring of outer radius 1 lying on the floor. */
function ring(material: MeshBasicMaterial): Mesh {
  const mesh = new Mesh(new RingGeometry(1 - RING_THICKNESS, 1, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Lays a disc or ring on the floor at `pos`, `radius` tiles wide. */
function place(mesh: Mesh, pos: { x: number; y: number }, radius: number) {
  mesh.position.set(pos.x, LIFT, pos.y);
  mesh.scale.set(radius, radius, 1);
}

/** A pie slice of radius 1 and half-angle `arc`, pointing along +x. */
function wedge(): { mesh: Mesh; shape: (arc: number) => void } {
  const positions = new BufferAttribute(
    new Float32Array((WEDGE_SEGMENTS + 2) * 3),
    3,
  );
  const geometry = new BufferGeometry().setAttribute("position", positions);
  const indices: number[] = [];
  for (let i = 1; i <= WEDGE_SEGMENTS; i++) indices.push(0, i, i + 1);
  geometry.setIndex(indices);
  const mesh = new Mesh(geometry, glow(TELEGRAPH.colour));
  mesh.frustumCulled = false;
  return {
    mesh,
    shape(arc) {
      positions.setXYZ(0, 0, 0, 0);
      for (let i = 0; i <= WEDGE_SEGMENTS; i++) {
        const angle = -arc + (2 * arc * i) / WEDGE_SEGMENTS;
        positions.setXYZ(i + 1, Math.cos(angle), 0, Math.sin(angle));
      }
      positions.needsUpdate = true;
    },
  };
}

/** The floor effects as meshes, to be updated each frame. */
export type FloorEffectMeshes = {
  group: Group;
  /** Shows the effects in `effects` and hides the meshes left over. */
  show: (effects: FloorEffectsView) => void;
};

/**
 * Telegraph wedges, Curse circles, Corpse bursts and the Level-Up ring,
 * lying flat on the floor in a pool of meshes.
 */
export function floorEffectMeshesOf(): FloorEffectMeshes {
  const group = new Group();

  const telegraphs = Array.from({ length: POOL.telegraphs }, () => {
    const reach = wedge();
    const filled = wedge();
    reach.mesh.renderOrder = 4;
    filled.mesh.renderOrder = 5;
    (reach.mesh.material as MeshBasicMaterial).opacity = TELEGRAPH.alpha.reach;
    (filled.mesh.material as MeshBasicMaterial).opacity =
      TELEGRAPH.alpha.filled;
    group.add(reach.mesh, filled.mesh);
    return { reach, filled };
  });

  const curses = Array.from({ length: POOL.curses }, () => {
    const fill = disc(glow(0xffffff));
    const edge = ring(glow(0xffffff));
    fill.renderOrder = edge.renderOrder = 4;
    group.add(fill, edge);
    return { fill, edge };
  });

  const marks = Array.from({ length: POOL.marks }, () => {
    const area = disc(glow(MUCK_MARK.colour));
    const filled = disc(glow(MUCK_MARK.colour));
    const edge = ring(glow(MUCK_MARK.colour));
    area.renderOrder = edge.renderOrder = 4;
    filled.renderOrder = 5;
    group.add(area, filled, edge);
    return { area, filled, edge };
  });

  const burns = Array.from({ length: POOL.burns }, () => {
    const fill = disc(glow(BURN.colour));
    const edge = ring(glow(BURN.colour));
    fill.renderOrder = edge.renderOrder = 4;
    group.add(fill, edge);
    return { fill, edge };
  });

  const bursts = Array.from({ length: POOL.bursts }, () => {
    const flash = disc(glow(CORPSE_BURST.flashColour));
    const edge = ring(glow(CORPSE_BURST.ringColour));
    flash.renderOrder = edge.renderOrder = 6;
    group.add(flash, edge);
    return { flash, edge };
  });

  const levelRing = ring(glow(LEVEL_UP.colour));
  levelRing.renderOrder = 6;
  group.add(levelRing);

  const opacity = (mesh: Mesh, alpha: number) => {
    (mesh.material as MeshBasicMaterial).opacity = alpha;
  };

  return {
    group,
    show(effects) {
      telegraphs.forEach(({ reach, filled }, i) => {
        const shown = effects.telegraphs[i];
        reach.mesh.visible = filled.mesh.visible = shown !== undefined;
        if (!shown) return;
        reach.shape(shown.arc);
        filled.shape(shown.arc);
        for (const [part, radius, lift] of [
          [reach.mesh, shown.reach, LIFT],
          [filled.mesh, shown.reach * shown.progress, LIFT + 0.005],
        ] as const) {
          part.position.set(shown.pos.x, lift, shown.pos.y);
          part.rotation.y = -shown.facing;
          part.scale.setScalar(Math.max(radius, 1e-3));
        }
      });
      curses.forEach(({ fill, edge }, i) => {
        const shown = effects.curses[i];
        fill.visible = edge.visible = shown !== undefined;
        if (!shown) return;
        place(fill, shown.pos, shown.radius);
        place(edge, shown.pos, shown.radius);
        // Pooled meshes take the colour of whichever Curse they show.
        for (const mesh of [fill, edge]) {
          (mesh.material as MeshBasicMaterial).color.setHex(shown.colour);
        }
        opacity(fill, CURSE_CIRCLE.fillAlpha * shown.alpha);
        opacity(edge, shown.alpha);
      });
      marks.forEach(({ area, filled, edge }, i) => {
        const shown = effects.marks[i];
        area.visible = filled.visible = edge.visible = shown !== undefined;
        if (!shown) return;
        const colour = MARK_COLOURS[shown.kind] ?? MUCK_MARK.colour;
        for (const mesh of [area, filled, edge]) {
          (mesh.material as MeshBasicMaterial).color.setHex(colour);
        }
        place(area, shown.pos, shown.radius);
        place(edge, shown.pos, shown.radius);
        place(filled, shown.pos, Math.max(shown.radius * shown.progress, 1e-3));
        opacity(area, MUCK_MARK.fillAlpha);
        opacity(edge, MUCK_MARK.edgeAlpha);
        opacity(filled, MUCK_MARK.filledAlpha);
      });
      burns.forEach(({ fill, edge }, i) => {
        const shown = effects.burns[i];
        fill.visible = edge.visible = shown !== undefined;
        if (!shown) return;
        place(fill, shown.pos, shown.radius);
        place(edge, shown.pos, shown.radius);
        // Fades out over the last of its burn.
        const fade = Math.min(1, shown.left / 0.25);
        opacity(fill, BURN.fillAlpha * fade);
        opacity(edge, BURN.edgeAlpha * fade);
      });
      bursts.forEach(({ flash, edge }, i) => {
        const shown = effects.bursts[i];
        flash.visible = edge.visible = shown !== undefined;
        if (!shown) return;
        place(flash, shown.pos, Math.max(shown.flash.radius, 1e-3));
        place(edge, shown.pos, Math.max(shown.ring.radius, 1e-3));
        opacity(flash, shown.flash.alpha);
        opacity(edge, shown.ring.alpha);
      });
      const shown = effects.levelRing;
      levelRing.visible = shown !== null;
      if (shown) {
        place(levelRing, shown.pos, Math.max(shown.radius, 1e-3));
        opacity(levelRing, shown.alpha);
      }
    },
  };
}
