import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";
import { PNG } from "pngjs";

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

/**
 * Repaints a skeleton's texture as rotting flesh, in place: bone becomes
 * grey-green skin; the eyes' glow and greys are kept.
 */
export async function rotTexture(path: string) {
  const io = new NodeIO();
  const document = await io.read(path);
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const png = PNG.sync.read(Buffer.from(image));
    for (let i = 0; i < png.data.length; i += 4) {
      const [red, green, blue] = [
        png.data[i],
        png.data[i + 1],
        png.data[i + 2],
      ];
      const light = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      const saturated = Math.max(red, green, blue) - Math.min(red, green, blue);
      // Glowing eyes keep their colour, and so do greys.
      if (green > 150 && blue < 90) continue;
      if (saturated < 25) continue;
      // Everything else, bone and leather alike, rots to green-grey skin.
      const pale = Math.max(0, (light - 0.55) / 0.45);
      png.data[i] = 40 + light * 130 + pale * 20;
      png.data[i + 1] = 62 + light * 165 + pale * 10;
      png.data[i + 2] = 36 + light * 90 + pale * 10;
    }
    texture.setImage(new Uint8Array(PNG.sync.write(png)));
  }
  await io.write(path, document);
}
