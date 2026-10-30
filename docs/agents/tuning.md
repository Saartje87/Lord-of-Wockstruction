# Tuning

For tuning tickets (how many kills a Level takes, how tough a Monster is in an Area), run:

```sh
npm run tuning:report
```

It prints, from the live tuning in `src/game/tuning/`:

- per Hero Level: the Experience to the next Level, an own-Level Monster's Experience, and the kills that takes
- per Combat Area in `content/areas/*.tmj` that places the Monster: its Area Level and the Monster's max Life, damage, Attack Rating, Defense and Experience there
- per cast Skill and Skill Level (1, 5, 10, 20): its Mana and main numbers (damage, Minion Life and damage, Curse duration and radius, Bone Ward soak), alone, with Synergies and with Passive Skills (every giver at that same Skill Level), and the casts a damage Skill takes to kill a Skeleton of each Combat Area

Read numbers from it instead of redoing the growth formulas or grepping `.tmj` files for `areaLevel` by hand. Run it again after changing tuning to see the effect.

The numbers come from `tuningReport` in `src/game/sim/tuningReport.ts` and `skillReport` in `src/game/sim/skillReport.ts`, which calls the sim's own functions. A sim test can import it to check a tuning goal, such as kills per Level staying in a range.
