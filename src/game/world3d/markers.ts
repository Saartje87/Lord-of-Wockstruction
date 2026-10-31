import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Path,
  Shape,
  ShapeGeometry,
} from "three";
import type { ClickMarkerView } from "./view";

/** The click marker's colour. */
const MARKER_COLOUR = 0xe8d27a;
/** How far above the floor the outlines lie, so they don't fight with it. */
const LIFT = 0.07;

/** A flat square frame, `size` across and `thickness` wide, in the x/z plane. */
function frame(size: number, thickness: number): ShapeGeometry {
  const half = size / 2;
  const inner = half - thickness;
  const shape = new Shape()
    .moveTo(-half, -half)
    .lineTo(half, -half)
    .lineTo(half, half)
    .lineTo(-half, half)
    .closePath();
  shape.holes.push(
    new Path()
      .moveTo(-inner, -inner)
      .lineTo(-inner, inner)
      .lineTo(inner, inner)
      .lineTo(inner, -inner)
      .closePath(),
  );
  return new ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

function outline(colour: number): Mesh {
  const mesh = new Mesh(
    frame(1, 0.05),
    new MeshBasicMaterial({
      color: colour,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  mesh.renderOrder = 1;
  return mesh;
}

/** The click marker outline on the floor. */
export type Markers = { click: Mesh };

/** Makes the markers, hidden. */
export function createMarkers(): Markers {
  return { click: outline(MARKER_COLOUR) };
}

/** Shows the markers as the view says. */
export function showMarkers(
  markers: Markers,
  view: { clickMarker: ClickMarkerView | null },
) {
  const { click } = markers;
  const { clickMarker } = view;
  click.visible = clickMarker !== null;
  if (clickMarker) {
    click.position.set(clickMarker.at.x, LIFT, clickMarker.at.y);
    click.scale.setScalar(1 - 0.6 * clickMarker.progress);
    (click.material as MeshBasicMaterial).opacity = 1 - clickMarker.progress;
  }
}
