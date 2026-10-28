// PROTOTYPE (throwaway) for T265: three looks for the Map Overlay and Mini Map.
// Lives only on the prototype/map-look branch.

export type HeroMark = "cross" | "arrow" | "ring";
export type MinionMark = "dot" | "square" | "triangle";
export type ExitMark = "diamond" | "chevron" | "door";
export type PortalMark = "ring" | "swirl" | "diamond";

export type Look = {
  label: string;
  wall: { color: string; width: number };
  floor: { color: string; width: number };
  /** Fill over walkable tiles (alpha 0 = none). */
  fill: { color: string; alpha: number };
  /** Opacity of the whole Map Overlay layer over the World. */
  overlayOpacity: number;
  hero: { mark: HeroMark; color: string; size: number };
  minion: { mark: MinionMark; color: string; size: number };
  exit: {
    mark: ExitMark;
    color: string;
    size: number;
    label: string;
    labelFont: string;
  };
  portal: { mark: PortalMark; color: string; size: number };
  npc: { color: string; font: string; outline: string | null };
  mini: {
    size: number; // CSS px square at UI Scale 1
    margin: number;
    scale: number; // map scale vs the World (1 = 192 px tiles)
    bg: string;
    border: {
      outer: string;
      outerWidth: number;
      inner: string | null;
      innerWidth: number;
    };
    radius: number;
    studs: string | null;
    opacity: number;
  };
};

/** Map Overlay scale vs the World, shared by all looks. */
export const OVERLAY_SCALE = 0.25;

export const LOOKS = {
  A: {
    label: "Classic automap",
    wall: { color: "#d8d0b4", width: 2 },
    floor: { color: "#7d8a94", width: 1 },
    fill: { color: "#000000", alpha: 0 },
    overlayOpacity: 0.55,
    hero: { mark: "cross", color: "#ffffff", size: 7 },
    minion: { mark: "dot", color: "#6fe06f", size: 2.5 },
    exit: {
      mark: "diamond",
      color: "#e8c45a",
      size: 7,
      label: "#e8c45a",
      labelFont: "600 12px Georgia, serif",
    },
    portal: { mark: "ring", color: "#6ab4ff", size: 6 },
    npc: { color: "#d4a84a", font: "600 11px Georgia, serif", outline: null },
    mini: {
      size: 176,
      margin: 12,
      scale: 0.14,
      bg: "rgba(0,0,0,0.45)",
      border: { outer: "#8a6d3b", outerWidth: 2, inner: null, innerWidth: 0 },
      radius: 0,
      studs: "#c9a45a",
      opacity: 0.85,
    },
  },
  B: {
    label: "Cool ice ink",
    wall: { color: "#7fd4ff", width: 2.5 },
    floor: { color: "#2f6f9a", width: 1 },
    fill: { color: "#2a6a96", alpha: 0.14 },
    overlayOpacity: 0.7,
    hero: { mark: "arrow", color: "#ffe14d", size: 8 },
    minion: { mark: "square", color: "#4de8e0", size: 2.5 },
    exit: {
      mark: "chevron",
      color: "#5dff9a",
      size: 7,
      label: "#d8ffe8",
      labelFont: "600 12px system-ui, sans-serif",
    },
    portal: { mark: "swirl", color: "#c08cff", size: 7 },
    npc: {
      color: "#ffffff",
      font: "500 11px system-ui, sans-serif",
      outline: "#06121c",
    },
    mini: {
      size: 160,
      margin: 14,
      scale: 0.12,
      bg: "rgba(6,18,28,0.55)",
      border: { outer: "#9fdcff", outerWidth: 1, inner: null, innerWidth: 0 },
      radius: 8,
      studs: null,
      opacity: 0.95,
    },
  },
  C: {
    label: "Bone and ember, filled",
    wall: { color: "#ece4cf", width: 3.5 },
    floor: { color: "#8c7a58", width: 1.5 },
    fill: { color: "#c9b48a", alpha: 0.2 },
    overlayOpacity: 0.4,
    hero: { mark: "ring", color: "#ff6a2a", size: 6 },
    minion: { mark: "triangle", color: "#f4efe0", size: 3.5 },
    exit: {
      mark: "door",
      color: "#ff7a3a",
      size: 8,
      label: "#ffd9c0",
      labelFont: "italic 600 12px Georgia, serif",
    },
    portal: { mark: "diamond", color: "#3ee0c8", size: 7 },
    npc: {
      color: "#e8dcc0",
      font: "italic 500 11px Georgia, serif",
      outline: "#1a1208",
    },
    mini: {
      size: 192,
      margin: 10,
      scale: 0.16,
      bg: "rgba(20,12,6,0.6)",
      border: {
        outer: "#2a1d12",
        outerWidth: 4,
        inner: "#b08a4a",
        innerWidth: 1.5,
      },
      radius: 4,
      studs: null,
      opacity: 0.9,
    },
  },
} satisfies Record<string, Look>;

export type LookKey = keyof typeof LOOKS;
export const LOOK_KEYS = Object.keys(LOOKS) as LookKey[];
