/**
 * Renders the KayKit tileset's thumbnails: each piece's model seen from the
 * game's camera angle, on a transparent background, into
 * `content/tilesets/kaykit/`. Run it by hand with `npm run thumbnails:kaykit`
 * after `npm run import:kaykit`; it needs Google Chrome.
 *
 * A tiny local server hands a headless Chrome one page that loads a model
 * with three.js, draws it and posts the picture back to the server.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname } from "node:path";
import { PIECES, pieceName } from "./pieces.mts";
import { THUMBNAIL_SIZE, thumbnailOf } from "./tileset.mts";

const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PAGE = `<!doctype html>
<html><body style="margin:0">
<script type="importmap">
{ "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const size = ${THUMBNAIL_SIZE};
const piece = new URLSearchParams(location.search).get("piece");
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(size, size);
renderer.setClearColor(0x000000, 0);
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f99, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-3, 6, 2);
scene.add(sun);
const gltf = await new GLTFLoader().loadAsync("/models/" + piece + ".glb");
scene.add(gltf.scene);

// The game's camera: 30 degrees down along the diagonal, looking at the
// middle of the piece, wide enough for all of it.
const sphere = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
const direction = new THREE.Vector3(1, 0, 1)
  .normalize()
  .multiplyScalar(Math.cos(Math.PI / 6))
  .setY(Math.sin(Math.PI / 6));
const half = sphere.radius * 1.05;
const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 1000);
camera.position.copy(sphere.center).addScaledVector(direction, 100);
camera.lookAt(sphere.center);
renderer.render(scene, camera);
await fetch("/save?piece=" + piece, { method: "POST", body: renderer.domElement.toDataURL("image/png") });
</script></body></html>`;

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".glb": "model/gltf-binary",
};

/** The thumbnail of each piece, by name, as posted by the page. */
const saved = new Map<string, () => void>();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = decodeURIComponent(url.pathname);
  if (request.method === "POST" && path === "/save") {
    const piece = url.searchParams.get("piece") ?? "";
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const source = PIECES.find((source) => pieceName(source) === piece);
      if (source) {
        writeFileSync(
          `content/tilesets/${thumbnailOf(source)}`,
          Buffer.from(body.replace(/^data:image\/png;base64,/, ""), "base64"),
        );
      }
      response.end();
      saved.get(piece)?.();
    });
    return;
  }
  const file = path.startsWith("/three/")
    ? `node_modules${path}`
    : path.startsWith("/models/")
      ? `public/assets${path}`
      : null;
  if (path === "/") {
    response.setHeader("content-type", "text/html");
    response.end(PAGE);
  } else if (file) {
    try {
      response.setHeader("content-type", TYPES[extname(file)] ?? "text/plain");
      response.end(readFileSync(file));
    } catch {
      response.statusCode = 404;
      response.end();
    }
  } else {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

mkdirSync("content/tilesets/kaykit", { recursive: true });
for (const source of PIECES) {
  const piece = pieceName(source);
  const posted = new Promise<void>((done) => saved.set(piece, done));
  const chrome = execFile(
    CHROME,
    [
      "--headless=new",
      "--user-data-dir=.cache/thumbnail-chrome",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      `http://127.0.0.1:${port}/?piece=${piece}`,
    ],
    () => {},
  );
  // The page posts its picture when it has drawn it; then Chrome has done.
  const gotIt = await Promise.race([
    posted.then(() => true),
    new Promise<boolean>((done) => setTimeout(() => done(false), 30_000)),
  ]);
  chrome.kill();
  if (!gotIt) throw new Error(`The page for ${piece} drew no thumbnail`);
  console.log(`Wrote content/tilesets/${thumbnailOf(source)}`);
}
server.close();
