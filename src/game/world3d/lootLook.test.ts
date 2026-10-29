// @vitest-environment node
import { NodeIO } from "@gltf-transform/core";
import { Euler, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PROJECTILE_LOOKS, projectilePlacements } from "./lootLook";

/**
 * The end of the arrow model that comes to a point: the extreme vertex on its
 * long (y) axis that sits on the axis itself. The other end is the nock and
 * fletching, which are wider than the shaft.
 */
async function arrowHeadOf(): Promise<Vector3> {
  const doc = await new NodeIO().read("public/assets/models/loot/arrow.glb");
  const position = doc
    .getRoot()
    .listMeshes()[0]
    .listPrimitives()[0]
    .getAttribute("POSITION");
  if (!position) throw new Error("the arrow has no vertices");
  const points: Vector3[] = [];
  for (let i = 0; i < position.getCount(); i++) {
    points.push(new Vector3(...position.getElement(i, [])));
  }
  const low = points.reduce((a, b) => (b.y < a.y ? b : a));
  const high = points.reduce((a, b) => (b.y > a.y ? b : a));
  const onAxis = (p: Vector3) => Math.hypot(p.x, p.z) < 1e-3;
  expect(onAxis(low) !== onAxis(high)).toBe(true);
  return onAxis(low) ? low : high;
}

describe("how a Projectile is laid", () => {
  it("flies the arrow head first (its head ends up towards +z, the way a yaw of 0 faces)", async () => {
    const head = (await arrowHeadOf()).applyEuler(
      new Euler(...PROJECTILE_LOOKS.arrow.lay),
    );
    expect(head.z).toBeGreaterThan(0.3);
    expect(Math.abs(head.x)).toBeLessThan(1e-3);
  });
});

describe("which way a laid Projectile points", () => {
  // Tile (x, y) is scene (x, 0, y), so a facing of f flies along
  // (cos f, 0, sin f); these are the four diagonals the Hero aims on screen.
  const FACINGS = [1, 3, 5, 7].map((n) => (n * Math.PI) / 4);

  /** Where `axis` of the model points once placed as `projectilePlacements` says. */
  function pointing(
    kind: "arrow" | "boneSpear",
    axis: Vector3,
    facing: number,
  ) {
    const [placement] = projectilePlacements({
      kind,
      pos: { x: 10, y: 10 },
      facing,
    });
    const laid = new Quaternion().setFromEuler(new Euler(...placement.lay));
    const turned = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      placement.yaw,
    );
    return axis.clone().applyQuaternion(laid).applyQuaternion(turned);
  }

  it("flies the arrow's point along the flight in every diagonal", () => {
    for (const facing of FACINGS) {
      const head = pointing("arrow", new Vector3(0, -1, 0), facing);
      expect(head.x).toBeCloseTo(Math.cos(facing), 5);
      expect(head.z).toBeCloseTo(Math.sin(facing), 5);
    }
  });

  it("lays the Bone Spear's long side along the flight in every diagonal", () => {
    for (const facing of FACINGS) {
      const bone = pointing("boneSpear", new Vector3(1, 0, 0), facing);
      expect(bone.x).toBeCloseTo(Math.cos(facing), 5);
      expect(bone.z).toBeCloseTo(Math.sin(facing), 5);
    }
  });
});
