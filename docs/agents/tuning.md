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
- per Minion kind (Golem, Raised Skeleton, Raised Archer) at Hero Levels 4, 8, 12, 16 and 20 (past the highest Area Level, so projected from the formulas), against an own-Level trash Skeleton: Skill Level, count, Life, Attack Rating, chance to hit, mean hit, damage per second and the seconds a full group of that kind takes to kill one Skeleton, plus all kinds together. It is shown twice, for the base Summoning Skills alone and with Passive Skills. Both follow one budget, printed above the tables: the Hero has Level - 1 Skill Points, half go into Summoning, spread evenly over the Summoning Skills open at that Level; with Passive Skills Grave Command (from Level 12) takes 25% of the budget and the rest is spread as before. Damage per second is chance to hit times mean hit over one swing (wind-up, root and recovery); it ignores walking, the Hero's own help and Skeleton hits on Minions, so read it as the best case. A row is missing when its Skill is not open yet. `minionReport` in `src/game/sim/minionReport.ts` holds the budget in code

Read numbers from it instead of redoing the growth formulas or grepping `.tmj` files for `areaLevel` by hand. Run it again after changing tuning to see the effect.

For a fight's length and danger, run `npm run tuning:fight -- <area> <unique> [--level N] [--seeds N]` (say `spa Bruckle --level 3`). It fights the Unique Monster alone with a just-levelled Hero in starting gear, once per seed, and prints the kill time, hits taken and that damage in Hero Lives, then the mean and range. Judge a low-Level Hero's fight with it rather than in the browser, where his pack decides the fight.

The numbers come from `tuningReport` in `src/game/sim/tuningReport.ts`, `skillReport` in `src/game/sim/skillReport.ts`, `minionReport` in `src/game/sim/minionReport.ts` and `fightReport` in `src/game/sim/fightReport.ts`, which call the sim's own functions. A sim test can import them to check a tuning goal, such as kills per Level staying in a range.
