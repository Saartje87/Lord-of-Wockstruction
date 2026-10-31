import { Group, IcosahedronGeometry, Mesh, MeshBasicMaterial } from "three";
import { inputTuning } from "../tuning/input";
import { puffOf } from "./puff";
import type { ClickMarkerView } from "./view";

/** The click marker: a pool of motes, made once. */
export type Markers = { click: Group };

/** Makes the markers, hidden. */
export function createMarkers(): Markers {
  const { motes, colour } = inputTuning.clickPuff;
  const geometry = new IcosahedronGeometry(0.5, 0);
  // Every mote is as opaque as the next, so they share one material.
  const material = new MeshBasicMaterial({
    color: colour,
    transparent: true,
    depthWrite: false,
  });
  const click = new Group();
  for (let i = 0; i < motes; i++) {
    const mote = new Mesh(geometry, material);
    mote.renderOrder = 1;
    click.add(mote);
  }
  click.visible = false;
  return { click };
}

/** Shows the markers as the view says. */
export function showMarkers(
  markers: Markers,
  view: { clickMarker: ClickMarkerView | null },
) {
  const { click } = markers;
  const { clickMarker } = view;
  click.visible = clickMarker !== null;
  if (!clickMarker) return;
  const puff = puffOf(clickMarker.at, clickMarker.progress);
  click.children.forEach((child, i) => {
    const mote = puff[i];
    child.position.set(
      clickMarker.at.x + mote.offset.x,
      mote.height,
      clickMarker.at.y + mote.offset.y,
    );
    child.scale.setScalar(mote.size);
  });
  const first = click.children[0] as Mesh;
  (first.material as MeshBasicMaterial).opacity = puff[0].opacity;
}
