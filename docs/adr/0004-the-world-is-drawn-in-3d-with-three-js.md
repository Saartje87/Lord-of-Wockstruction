# The World is drawn in 3D with three.js, the HUD stays in Pixi

Wiablo's look is to be gothic cartoon, in the vein of Torchlight, and the Flare sprites (realistic pre-rendered art, CC-BY-SA) can't get there. A throwaway prototype (branch `prototype/3d-renderer`, PR #28) drew the real simulation in 3D with three.js and KayKit's CC0 models, and ran at a steady 60 fps on desktop and on a Pixel 7a. So the World is drawn in 3D with three.js, under a fixed isometric camera at the 2D game's angle and World zoom, while the HUD, panels and screen-space labels stay in Pixi, drawn on top through one shared canvas and WebGL context. The simulation doesn't change (ADR 0001).

## Considered Options

- **Pre-rendered sprites from 3D models**, keeping Pixi as the only renderer: cheap on phones, but no real lights, and every Monster, animation and piece of equipment needs re-rendering into 8-direction sheets. Rejected once 3D held 60 fps on a phone.
- **Babylon.js for everything**, its GUI replacing the Pixi HUD: one engine, but about eight times the download and a rewrite of the whole HUD that players would never see. Rejected.
- **PlayCanvas**: built around its cloud editor rather than code-first use. Rejected.
- **three.js with the HUD rewritten in HTML**: no second library, but the same HUD rewrite. Rejected for now; the HUD can still move later without touching the World.

## Consequences

- **Moving over in steps.** The 3D World was built beside the 2D one: first behind `?renderer=3d`, then as a "3D World (beta)" choice in the pause menu. It is now the only World: the choice, the Pixi World drawing and the Flare art are gone (T396).
- **Rules for content.** Every model is CC0, brought in by an import script that pins its source and keeps only the animations used, because the repo is public and Quaternius's QAL forbids redistributing its files.
- **Areas.** They stay in Tiled, painted with a KayKit tileset whose tiles say whether they are floor, Wall or Prop. Walls join up with their neighbours, and those between the camera and the Hero are lowered.
- **Darkness.** It is mood only: what the Hero can see, target and Explore follows the same rules as in 2D.
