import type { FrameStatsReading } from "./frameStats";

/**
 * The `?stats` panel at the top left, over the canvas: plain DOM, so it
 * costs the frame nothing it measures. Dev builds and previews only.
 */
export function createStatsPanel(parent: HTMLElement): HTMLPreElement {
  const panel = document.createElement("pre");
  Object.assign(panel.style, {
    position: "fixed",
    top: "8px",
    left: "8px",
    margin: "0",
    padding: "6px 8px",
    font: "12px/1.4 ui-monospace, monospace",
    color: "#e8dcc8",
    background: "rgba(0, 0, 0, 0.6)",
    borderRadius: "6px",
    pointerEvents: "none",
    zIndex: "1",
  });
  parent.appendChild(panel);
  return panel;
}

/** Shows a reading on the panel. */
export function showReading(panel: HTMLPreElement, reading: FrameStatsReading) {
  const { calls, triangles } = reading.drawn;
  const lines = [
    `${reading.fps.toFixed(0)} fps  ${reading.frameMs.toFixed(1)} ms/frame`,
    `${calls} draw calls  ${(triangles / 1000).toFixed(1)}k triangles`,
  ];
  panel.textContent = lines.join("\n");
}
