# Coding standards

Judgement rules for review. Anything a tool can enforce lives in `biome.json`, `tsconfig.json` or the tests instead.

## Domain language

Names in code, comments and on-screen text use the terms in `GLOSSARY.md`. Where the glossary lists _Avoid_ words for a concept, use the term itself: `heroPanel`, not `characterPanel`; `derived`, not `stats`; "full Life", not "full health". An Avoid word is fine where it means something else (`CharacterArt` covers the Hero's and Monsters' sprites). A UI name the glossary doesn't have yet gets a glossary entry, not a borrowed word.

## The simulation

`docs/adr/0001-pure-fixed-step-simulation.md` is the rule. In review, look for:

- Values the Hero derives from progress and tuning (max Life, damage range, Attack Rating, hit chance) as pure queries on the World, computed where they're read, never stored as fields that can drift.
- Every number someone might balance in `src/game/tuning`, in human units, converted once.
- Each concept's list (`ATTRIBUTES`, the Experience table) as the single source that UI rows, Save checks and tests are driven from.

## Tests

Tests sit at the existing seams (`createWorld` + `step` → events, World queries, pure render helpers, the Save module) and assert what those return, not internal fields. A tuning value a test overrides is restored in `afterEach`.

A divergence from the spec made to keep an existing test unchanged is a finding: the test changes instead.

## Style

Match the surrounding file: one JSDoc line on each export and each non-obvious function, short intent comments, full words over one-letter aliases.

Comments stay true. When the diff changes what something does or draws, check the JSDoc of each function it touches and of the constants those use, and flag any that still describe the old behaviour. Specs are written from these comments, so a stale one becomes a wrong spec.
