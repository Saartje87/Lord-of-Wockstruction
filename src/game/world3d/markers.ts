import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Path,
  Shape,
  ShapeGeometry,
} from "three";
import type { ClickMarkerView } from "./view";

/** The click marker's colour and the hover tile's. */
const MARKER_COLOUR = 0xe8d27a;
const HOVER_COLOUR = 0xd8c48a;
const HOVER_OPACITY = 0.7;
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

/** The click marker and hover tile outlines on the floor. */
export type Markers = { click: Mesh; hover: Mesh };

/** Makes the markers, hidden. */
export function createMarkers(): Markers {
  return { click: outline(MARKER_COLOUR), hover: outline(HOVER_COLOUR) };
}

/** Shows the markers as the view says. */
export function showMarkers(
  markers: Markers,
  view: {
    clickMarker: ClickMarkerView | null;
    hoverTile: { x: number; y: number } | null;
  },
) {
  const { click, hover } = markers;
  const { clickMarker, hoverTile } = view;
  click.visible = clickMarker !== null;
  if (clickMarker) {
    click.position.set(clickMarker.at.x, LIFT, clickMarker.at.y);
    click.scale.setScalar(1 - 0.6 * clickMarker.progress);
    (click.material as MeshBasicMaterial).opacity = 1 - clickMarker.progress;
  }
  hover.visible = hoverTile !== null;
  if (hoverTile) {
    hover.position.set(hoverTile.x + 0.5, LIFT, hoverTile.y + 0.5);
    (hover.material as MeshBasicMaterial).opacity = HOVER_OPACITY;
  }
}
