import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

/**
 * Copies a character's glb to `to`, keeping only the animations named in
 * `clips` and dropping the nodes `dropNodes` says yes to (with their
 * children), then everything nothing uses any more.
 */
export async function importCharacter(options: {
  from: string;
  to: string;
  clips: string[];
  dropNodes: (name: string) => boolean;
}) {
  const io = new NodeIO();
  const document = await io.read(options.from);
  const root = document.getRoot();

  const clips = new Set(options.clips);
  const have = root.listAnimations().map((animation) => animation.getName());
  for (const clip of clips) {
    if (!have.includes(clip)) {
      throw new Error(`${options.from} has no animation "${clip}"`);
    }
  }
  for (const animation of root.listAnimations()) {
    if (clips.has(animation.getName())) continue;
    // The channels and samplers hold the keyframes, so go with it.
    for (const channel of animation.listChannels()) channel.dispose();
    for (const sampler of animation.listSamplers()) sampler.dispose();
    animation.dispose();
  }
  for (const node of root.listNodes()) {
    if (options.dropNodes(node.getName())) node.dispose();
  }
  await document.transform(prune());
  await io.write(options.to, document);
  console.log(`Wrote ${options.to}`);
}
