import { type Application, Container, Graphics } from "pixi.js";
import { TILE_HEIGHT, TILE_WIDTH, toScreen } from "../iso";
import { type Area, isFloor } from "../sim/area";
import type { World } from "../sim/world";

const FLOOR_FILL = 0x3a3428;
const FLOOR_LINE = 0x241f17;
const HERO_FILL = 0xc9a24a;

/** Draws an Area and the World in it into a Pixi stage, following the Hero. */
export function createRenderer(app: Application, area: Area) {
  const camera = new Container();
  app.stage.addChild(camera);

  camera.addChild(drawFloor(area));
  const hero = drawHero();
  camera.addChild(hero);

  return {
    /** `alpha` (0..1) is how far the frame is from the previous step to the current one. */
    draw(world: World, alpha: number) {
      const { pos, prevPos } = world.hero;
      const at = toScreen({
        x: prevPos.x + (pos.x - prevPos.x) * alpha,
        y: prevPos.y + (pos.y - prevPos.y) * alpha,
      });
      hero.position.set(at.x, at.y);
      camera.position.set(
        Math.round(app.screen.width / 2 - at.x),
        Math.round(app.screen.height / 2 - at.y),
      );
    },
  };
}

function drawFloor(area: Area) {
  const floor = new Graphics();
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!isFloor(area, x, y)) continue;
      const top = toScreen({ x, y });
      floor
        .poly([
          top.x,
          top.y,
          top.x + halfW,
          top.y + halfH,
          top.x,
          top.y + TILE_HEIGHT,
          top.x - halfW,
          top.y + halfH,
        ])
        .fill(FLOOR_FILL)
        .stroke({ color: FLOOR_LINE, width: 1 });
    }
  }
  return floor;
}

/** A placeholder Hero standing on its origin. */
function drawHero() {
  return new Graphics()
    .ellipse(0, 0, 12, 6)
    .fill({ color: 0x000000, alpha: 0.4 })
    .roundRect(-8, -36, 16, 36, 6)
    .fill(HERO_FILL);
}
