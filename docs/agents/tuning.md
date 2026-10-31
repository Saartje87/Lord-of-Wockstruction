# Tuning

For tuning tickets (how many kills a Level takes, how tough a Monster is in an Area), run:

```sh
npm run tuning:report
```

It prints, from the live tuning in `src/game/tuning/`:

- per Hero Level: the Experience to the next Level, an own-Level Monster's Experience, and the kills that takes, with the Gold those kills drop: the Area Level played at (the deepest Combat Area placing the Monster at or below the Hero Level), the expected Gold of one kill there (Gold Pile chance times mean amount) and that times the kills. Compare it with Potion Values; the target is a Life Potion near 25 Gold and a run through a Combat Area paying for a Belt's worth of Potions
- per Unique Monster in `content/areas/*.tmj` (Bruckle in the Spa): its Area Level and its Life, damage, Attack Rating, Defense and Experience there, Unique multipliers included
- per Combat Area in `content/areas/*.tmj` that places the Monster: its Area Level and the Monster's max Life, damage, Attack Rating, Defense and Experience there
- per cast Skill and Skill Level (1, 5, 10, 20): its Mana and main numbers (damage, Minion Life and damage, Curse duration and radius, Bone Ward soak), alone, with Synergies and with Passive Skills (every giver at that same Skill Level), and the casts a damage Skill takes to kill each kind of Monster in each Combat Area

Read numbers from it instead of redoing the growth formulas or grepping `.tmj` files for `areaLevel` by hand. Run it again after changing tuning to see the effect.

For a fight's length and danger, run `npm run tuning:fight -- <area> <unique> [--level N] [--seeds N]` (say `spa Bruckle --level 3`). It fights the Unique Monster alone with a just-levelled Hero in starting gear, once per seed, and prints the kill time, hits taken and that damage in Hero Lives, then the mean and range. Judge a low-Level Hero's fight with it rather than in the browser, where his pack decides the fight.

The numbers come from `tuningReport` in `src/game/sim/tuningReport.ts`, `skillReport` in `src/game/sim/skillReport.ts` and `fightReport` in `src/game/sim/fightReport.ts`, which call the sim's own functions. A sim test can import them to check a tuning goal, such as kills per Level staying in a range.
