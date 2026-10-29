import { type Document, type Node, NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

type Quat = [number, number, number, number];
type Vec3 = [number, number, number];

/** A clip to give the character: `name` from the glb at `from`. */
export type ClipSource = { from: string; name: string };

/**
 * Copies a KayKit Mystery Monthly character's glb to `to` with the clips in
 * `clips`. Those characters carry no clips of their own: they come from the
 * pack's `Rig_Medium` or `Rig_Large` files, or from a free KayKit character.
 *
 * Every clip is retargeted by joint name onto the character's rest pose, so
 * a clip made on another rig fits too: rotations keep their turn away from
 * the source's rest pose, and translations their offset, scaled by how much
 * higher the character's hips are. Tracks for joints the character doesn't
 * have, like the free rig's IK bones, are dropped. On the character's own
 * rig the retarget changes nothing.
 */
export async function importRiggedCharacter(options: {
  from: string;
  to: string;
  clips: ClipSource[];
}) {
  const io = new NodeIO();
  const document = await io.read(options.from);
  const joints = jointsByName(document);
  const sources = new Map<string, Document>();

  for (const clip of options.clips) {
    let source = sources.get(clip.from);
    if (!source) {
      source = await io.read(clip.from);
      sources.set(clip.from, source);
    }
    copyClip(source, clip, document, joints);
  }
  await document.transform(prune());
  await io.write(options.to, document);
  console.log(`Wrote ${options.to}`);
}

function jointsByName(document: Document): Map<string, Node> {
  const skin = document.getRoot().listSkins()[0];
  if (!skin) throw new Error("The character has no skin");
  return new Map(skin.listJoints().map((joint) => [joint.getName(), joint]));
}

function copyClip(
  source: Document,
  clip: ClipSource,
  target: Document,
  targetJoints: Map<string, Node>,
) {
  const animation = source
    .getRoot()
    .listAnimations()
    .find((candidate) => candidate.getName() === clip.name);
  if (!animation)
    throw new Error(`${clip.from} has no animation "${clip.name}"`);

  const sourceJoints = jointsByName(source);
  const scale = hipsHeight(targetJoints) / hipsHeight(sourceJoints);
  const buffer = target.getRoot().listBuffers()[0];
  const copy = target.createAnimation(clip.name);

  for (const channel of animation.listChannels()) {
    const name = channel.getTargetNode()?.getName() ?? "";
    const from = sourceJoints.get(name);
    const to = targetJoints.get(name);
    const path = channel.getTargetPath();
    const sampler = channel.getSampler();
    if (!from || !to || !path || !sampler) continue;
    if (path === "weights") continue;

    const interpolation = sampler.getInterpolation();
    if (interpolation === "CUBICSPLINE") {
      throw new Error(`${clip.name} on ${name} is cubic, which isn't handled`);
    }
    const input = sampler.getInput()?.getArray();
    const output = sampler.getOutput()?.getArray();
    if (!input || !output) continue;

    const values =
      path === "rotation"
        ? retargetRotations(output, from.getRotation(), to.getRotation())
        : path === "translation"
          ? retargetTranslations(
              output,
              from.getTranslation(),
              to.getTranslation(),
              scale,
            )
          : Float32Array.from(output);

    const times = target
      .createAccessor()
      .setType("SCALAR")
      .setArray(Float32Array.from(input))
      .setBuffer(buffer);
    const keys = target
      .createAccessor()
      .setType(path === "rotation" ? "VEC4" : "VEC3")
      .setArray(values)
      .setBuffer(buffer);
    const copiedSampler = target
      .createAnimationSampler()
      .setInput(times)
      .setOutput(keys)
      .setInterpolation(interpolation);
    copy
      .addSampler(copiedSampler)
      .addChannel(
        target
          .createAnimationChannel()
          .setTargetNode(to)
          .setTargetPath(path)
          .setSampler(copiedSampler),
      );
  }
}

function hipsHeight(joints: Map<string, Node>): number {
  const hips = joints.get("hips");
  if (!hips) throw new Error("The rig has no hips joint");
  return hips.getTranslation()[1];
}

/** Each key keeps its turn away from the source rest: to · from⁻¹ · key. */
function retargetRotations(keys: ArrayLike<number>, from: Quat, to: Quat) {
  const turn = multiply(to, conjugate(from));
  const out = new Float32Array(keys.length);
  for (let i = 0; i < keys.length; i += 4) {
    const key: Quat = [keys[i], keys[i + 1], keys[i + 2], keys[i + 3]];
    out.set(multiply(turn, key), i);
  }
  return out;
}

/** Each key keeps its offset from the source rest, scaled: to + (key − from)·k. */
function retargetTranslations(
  keys: ArrayLike<number>,
  from: Vec3,
  to: Vec3,
  scale: number,
) {
  const out = new Float32Array(keys.length);
  for (let i = 0; i < keys.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      out[i + axis] = to[axis] + (keys[i + axis] - from[axis]) * scale;
    }
  }
  return out;
}

function multiply([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function conjugate([x, y, z, w]: Quat): Quat {
  return [-x, -y, -z, w];
}
