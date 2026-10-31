# Lord of Wockstruction

A single-player, browser-based hack and slash action RPG inspired by Diablo 1 and 2.

## Language

**Vertical Slice**:
The first playable version: one Town, one Combat Area, and the core loop between them.
_Avoid_: MVP, demo

**Hero**:
The single character the player controls.
_Avoid_: Player (the person), character, avatar

**Town**:
A safe Area where no combat happens and where the Hero starts and returns after death.
_Avoid_: Hub, village

**Combat Area**:
An Area outside Town where Monsters live and combat happens.
_Avoid_: Level, dungeon, zone, map

**Area Level**:
How hard a Combat Area is: every Monster in it has this as its Monster Level. Town has none.
_Avoid_: Level (that's the Hero's), difficulty, depth

**Area**:
A distinct place the Hero can be in; Town and Combat Areas are both Areas.
_Avoid_: Level, zone, map, scene

**Act**:
One chapter of the game: its own Town, a Main Path of Combat Areas leading out from it to the Act Boss, Side Areas off that path, and five Quests along the way. Only killing the Act Boss is needed to complete it; the other Quests are there for their rewards.
_Avoid_: Chapter, episode, world

**Main Path**:
The chain of Combat Areas leading from an Act's Town to its Act Boss, its Area Level rising along the way.
_Avoid_: Critical path, route

**Side Area**:
A Combat Area in an Act that is not on its Main Path, reached from one of the Main Path's Areas; it has no Waypoint.
_Avoid_: Side dungeon, optional area, branch

**Act Boss**:
The one named Monster at the end of an Act's Main Path; killing it while the Act's last Quest isn't Done completes the Act, shown across the screen, and makes that Quest Ready to hand in. It is back, like every Monster, in each new Session. Act 1's is Grave Wockington.
_Avoid_: Final boss, end boss

**Waypoint**:
A fixed spot in an Act's Town and in every Combat Area on its Main Path, the Act Boss's included, never in a Side Area; once the Hero has touched one, walking onto it opens the list of that Act's Waypoints, and picking a touched one takes them there, leaving the Area as an Exit does. The Save keeps which ones they have touched.
_Avoid_: Teleporter, checkpoint, Town Portal (that's the Hero's own)

**Quest**:
A task an NPC in an Act's Town gives the Hero and takes back once it is done, going from Not given to Given, Ready to hand in and Done. What it asks counts whenever it happens, given or not, so a Quest can go straight from Not given to Ready to hand in; its reward comes once, on Done. The Save keeps how far each Quest has got.
_Avoid_: Mission, task, objective

**Smith bonus**:
The one random bonus the Smith gives a Weapon, Shield, Helm, Armour, Gloves or Boots of any Rarity, from a pool suited to its kind, once "Spa Day" is Done. His service works once; the Hero can leave without using it and come back later. The bonus stays with that Item, shows in its tooltip after its Affixes and counts while it is Equipped. It is never an Affix: it doesn't count towards an Item's Affixes, never changes its name, adds nothing to its Value, and adds to an Affix giving the same Bonus. The Save keeps the bonus on its Item and whether the service is unlocked and unspent.
_Avoid_: Enchant, Affix (a different thing)

**Exit**:
A zone in an Area that, when the Hero walks into it, takes the Hero to an Entry in another Area.
_Avoid_: Portal (that's the Town Portal), door, transition, warp

**Wall**:
A blocking part of an Area's edge that joins up with the Walls beside it into one stretch of wall; a Wall standing between the view and the Hero is drawn lowered, so the Hero stays in sight.
_Avoid_: Wall tile, barrier, obstacle

**Prop**:
An object standing on an Area's floor, such as a barrel, a gravestone or a candle; some block the way and some don't.
_Avoid_: Decoration, doodad, object

**Water**:
Tiles of an outdoor Area that nothing walks into, though Projectiles fly over them; the Spa's are hot springs.
_Avoid_: Lake, pond tile, river (except as a place's description)

**Town Portal**:
A two-way gateway the Hero opens a step ahead of them anywhere outside Town, its other end at a fixed place in Town; the Hero goes through by walking into it, as with an Exit, and nothing else does. The Hero has at most one: opening another closes the old, and going back through it from Town closes it. It stays open through the Hero's Death and through Exits, and the Save never keeps one.
_Avoid_: Portal on its own, TP, waypoint, gate

**Session**:
One stretch of play, from Continue or New Hero on the Start Screen until Quit to Start Screen or the game is closed. Every Area starts fresh in a new Session, all its Monsters back where they were placed, except what a Done Quest has put away for good, such as its Bone Altars. From then until the Session ends, each Area stands still while the Hero is away and is just as they left it when they come back, by any way in: its Monsters, Corpses, Ground Items and Gold Piles where they were, and what of it is Explored. The Hero's Death doesn't end a Session.
_Avoid_: Game, run, instance

**Explored**:
The part of an Area the Hero has come near enough to see, the only part the Map Overlay and Mini Map show; all of Town is Explored from the start. It is kept for each Area until the Session ends, and the Save never keeps it.
_Avoid_: Revealed, discovered, fog of war

**Map Overlay**:
The Explored part of the current Area drawn see-through over the World, centred on the Hero, while play goes on underneath: wall and floor edges, the Hero, their Minions, Exits named for the Area they lead to, the Town Portal and, in Town, NPCs by name; never Monsters, Corpses, Ground Items or Gold Piles. It shows the Area's display name, never its Area Level, stays open through Exits and Town Portals, and closes on the Hero's Death.
_Avoid_: Automap, map, full map

**Mini Map**:
The small map at the top right of the HUD showing, as the Map Overlay does, the Explored part of the current Area around the Hero; it is always there except while the Map Overlay or a panel is open and during Death, and clicking or tapping it opens the Map Overlay.
_Avoid_: Radar, minimap, map

**Entry**:
A named place in an Area where the Hero appears on arriving; the Entry named `start` is where the Hero begins.
_Avoid_: Spawn point (that's for Monsters), arrival

**Area Banner**:
An Area's display name, shown across the screen for a few seconds whenever the Hero arrives in an Area, Town included; it never shows an Area Level.
_Avoid_: Title card, zone text, toast

**Boss bar**:
The Act Boss's name and Life, shown across the top of the screen while it is In Combat with the Hero, with a mark at half its Life; it goes when the Act Boss dies or starts Returning.
_Avoid_: Boss health bar, boss HP, nameplate (that's on hover)

**Minion Frame**:
The Hero's living Minions shown at the top left of the HUD, one row per Minion kind that has any alive, always Golem, then Raised Skeletons, then Raised Archers: the kind's picture, how many the Hero has out of how many they can have (never for the Golem, of which there is only one), and a thin Life bar for each of them, oldest first, flashing when it is hit. It shows only while the Hero has Minions, the Map Overlay or a panel open or not, a panel drawn over it where they meet, and can't be clicked or tapped.
_Avoid_: Portrait (that's the screen held upright), party frame, minion bar

**Monster**:
A hostile creature that attacks the Hero and their Minions and can be killed.
_Avoid_: Enemy, mob, NPC

**Monster type**:
What kind of Monster one is, such as the Skeleton or the Wockwolf: its name, look, way of fighting and numbers at each Monster Level. The undead types (Skeleton, Skeleton Archer, Zombie) grow more common toward the Wockyard and below it; the living ones (Wockwolf, Bog Spitter, Wockbrute) belong to the outdoor Areas.
_Avoid_: Monster kind, species, class

**Wockwolf**:
A fast, fragile Monster type that comes in packs and surrounds the Hero, most common in the Cozy Plains; like every Monster, it never runs from a fight unless Fleeing.
_Avoid_: Wolf, werewolf

**Bog Spitter**:
A plant Monster type that lobs muck at where the Hero stands, most common in the Soggy Bog.
_Avoid_: Plant, spitter, Mucksprout

**Wockbrute**:
A big, slow Monster type whose Slam hits everything of the Hero's around it, most common in the Old Mill and never in the Cozy Plains.
_Avoid_: Brute, orc, ogre

**Unique Monster**:
A named Monster, one of its kind, placed by hand in an Area: a bigger, tougher version of its Monster type that gives more Experience and always drops a Rare Item and a Magic or better one, its name shown in a gold colour no Item's name uses. It has no powers its type lacks. The Act Boss is one, with a Monster type of its own.
_Avoid_: Boss (except the Act Boss), champion, elite, rare

**Bruckle**:
The Unique Monster, a Wockbrute, who has taken over the Spa, guarded by a pack of Wockwolves; killing him is the task of "Spa Day".
_Avoid_: Spa boss

**Grave Wockington**:
The Act Boss of Act 1, one of the Lord of Wockstruction's lieutenants, waiting alone in the Ossuary's last room. A slow caster that nothing makes flinch, he stands off from the Hero lobbing Gravefire and swings only at what comes right up to him. Every so often he raises a wave of Skeletons around himself whose Corpses the Hero can turn against him; they fall dead when he dies or starts Returning. Once he is down to half his Life he flares up and raises a wave at once, and from then on his waves come faster and bigger, with a Skeleton Archer in each, and he casts more often. Every Curse but Dread's takes hold on him. He drops more than any other Unique Monster.
_Avoid_: Wockington, the boss, Grave (alone)

**Bone Altar**:
A Prop with Life that raises a Monster beside it every so often, up to a limit, until the Hero destroys it with attacks or Skills; Monsters leave it be.
_Avoid_: Totem, spawner, Monster

**Monster Level**:
How strong a Monster is: the same Monster type is tougher, hits harder and gives more Experience at a higher Monster Level.
_Avoid_: Level (that's the Hero's), tier, difficulty

**Leash**:
How far a Monster will chase the Hero or their Minion from where it was placed before it gives up and starts Returning.
_Avoid_: Tether, chase range, aggro range

**Body**:
The room the Hero, a Monster or a Minion takes up while alive, its size set by its Monster type or Minion kind, a Unique Monster's bigger than its type's. Bodies on opposite sides block each other: Monsters can hem the Hero in and Minions can hold a line against them. Bodies on the same side shove each other apart instead, never staying stacked, and the Hero's Minions always give way to the Hero. Every Body fits wherever the Hero's does; a Corpse, a Ground Item or a Gold Pile has none.
_Avoid_: Footprint, hitbox, collider, radius

**Returning**:
A Monster walking back to where it was placed after giving up on the Hero or their Minion, ignoring both on the way and healing to full on arrival; it happens past the Leash or on the Hero's Death.
_Avoid_: Resetting, evading, retreating

**NPC**:
A non-hostile character the Hero can talk to, normally standing in Town.
_Avoid_: Villager, townsperson

**Dialogue panel**:
The panel talking to an NPC opens: what they say, and the Quest they have to give or take back, if any. The World plays on underneath, and the Hero taking damage shuts it. The Hero talks to an NPC by clicking them, or, with no Monster as the Target, as a Ground Item is picked up.
_Avoid_: Chat, conversation window, dialog box

**Quest panel**:
The panel listing the current Act's Quests, how far each has got and, for each one Given, what to do next.
_Avoid_: Quest log, journal

**Life**:
The Hero's, a Monster's or a Minion's health; reaching zero means death.
_Avoid_: HP, health

**Death**:
The Hero's state once their Life reaches zero: they lie where they fell, and Monsters and their Projectiles leave them be, until the player sends them back to Town.
_Avoid_: Game over, defeat

**In Combat**:
The Hero's state while they have dealt or taken damage in the last few seconds, or while a Monster is chasing them or their Minion; outside it, the Hero slowly regains Life.
_Avoid_: Aggro, engaged

**Corpse**:
What remains of a dead Monster, lying in its Area until the Hero leaves or a Skill uses it up. A Skill that needs one takes the nearest Corpse a short way from where it is cast, and with none there the cast does nothing and costs nothing.
_Avoid_: Body (that's the living creature's room), dead body, remains

**Experience**:
What the Hero earns when they or their Minions kill Monsters, less for a Monster whose Monster Level is well below the Hero's Level; enough of it raises the Hero's Level.
_Avoid_: XP, EXP

**Level**:
How far the Hero has advanced, from 1 up, raised by earning Experience; reaching a new Level also fills the Hero's Life and Mana.
_Avoid_: Character level, rank (and never a place: that's an Area)

**Attribute**:
One of the Hero's four permanent traits, Strength, Dexterity, Vitality and Energy, raised only by spending Attribute Points.
_Avoid_: Stat

**Energy**:
The Attribute that raises the Hero's Mana.
_Avoid_: Intelligence, magic

**Mana**:
What the Hero spends to cast Skills; unlike Life it regenerates all the time, In Combat or not.
_Avoid_: MP, energy (that's the Attribute)

**Attribute Point**:
What the Hero gains five of on each new Level, kept until the player spends it to raise an Attribute by one; it is spent only when the player accepts it, and a spent point can't be taken back.
_Avoid_: Stat point

**Pending Attribute Point**:
An Attribute Point the player has put on an Attribute in the Hero panel but not yet accepted; it can still be taken off, and is lost back to the unspent points if the panel closes first. The Save never keeps one.
_Avoid_: Planned point, draft point

**Skill**:
Something the Hero learns on the Skill Tree: most are cast, spending Mana, and can't be cast in Town; a Passive Skill never is. Every Hero can learn the same Skills, from the one Skill Tree. Damage a Skill deals always hits: it is never a Miss.
_Avoid_: Spell, ability, power

**Passive Skill**:
A Skill that is never cast, costs no Mana and only works by being learned, making the Hero or what their other Skills do stronger for as long as it has a Skill Level. Each Branch ends in one; it never goes on the Skill Bar or becomes a Held Skill, and it neither gives nor gets Synergies.
_Avoid_: Mastery, aura, trait

**Skill Tree**:
All the Skills the Hero can learn, in three Branches, and how far each has been learned.
_Avoid_: Talent tree, spellbook

**Branch**:
One of the three themed parts of the Skill Tree, Bone, Summoning and Curses, each Skill belonging to exactly one, at its own place in that Branch's grid of three columns and six rows. The Skill Tree panel shows one Branch at a time, picked by its Branch tab.
_Avoid_: Tab, school, tree (that's the whole Skill Tree)

**Prerequisite**:
A Skill higher in the same Branch that a Skill hangs from, shown by an arrow between them; a Skill can have one, several or none, and every one must have a Skill Level before a Skill Point can be spent on the Skill below. A Skill also needs the Hero to have reached its own Level. It only holds back spending Skill Points: a Skill Level already learned can always be cast.
_Avoid_: Requirement, unlock

**Skill Tree panel**:
The panel showing the Skill Tree one Branch at a time: a Branch tab for each, giving the Skill Points spent in it, and that Branch's Skills as icons in its grid, joined by arrows to their Prerequisites. Each icon shows its Skill Level, is dimmed until learned and has a + while a Skill Point can be spent on it; a Passive Skill's icon has its own frame. It opens on the Branch last looked at.
_Avoid_: Spell panel, spellbook, skill window

**Branch tab**:
The tab on the Skill Tree panel that shows one Branch; it is never the Branch itself.
_Avoid_: Page, tree tab

**Skill tooltip**:
What a Skill shows when hovered, Focused or Long Pressed: its name, Skill Level and what it does at that Skill Level, as final numbers with its Synergies and Passive Skills already counted: damage with its Damage Types, Mana cost, radius, duration, a Minion's Life and damage and how many, and the like. While a Skill Point can be spent on it, the same numbers follow for the next Skill Level; a Skill not yet learned shows Skill Level 1's. Its Synergies, Prerequisites and needed Level are listed after.
_Avoid_: Skill description, spell info

**Skill Point**:
What the Hero gains one of on each new Level, kept until the player spends it to raise a Skill's Skill Level by one; a spent point can't be taken back.
_Avoid_: Talent point

**Skill Level**:
How far the Hero has learned a Skill: the Skill Points spent on it plus what their Equipped Wands add, which needs no Prerequisite and goes when the Wand comes off. A Skill can be cast once its Skill Level is above 0; each higher Skill Level makes it stronger.
_Avoid_: Rank (and never the Hero's Level)

**Synergy**:
A lasting bonus one cast Skill gets from each Skill Level the Hero has in another, of any Branch, however that Skill Level was gained, so raising one makes the other stronger too; the receiving Skill's tooltip lists its Synergies and what they add now.
_Avoid_: Combo, interaction, bonus skill

**Skill Bar**:
The row of five slots holding the Skills the player casts, each slot cast by its own button: the right mouse button or a key, a controller button, or an on-screen button; a Skill is cast at the cursor, or at the Target when there is no cursor.
_Avoid_: Hotbar, action bar

**Held Skill**:
The one Skill the player has picked up from the Skill Tree or the Skill Bar, on the cursor, to put in a Skill Bar slot; the Skill Bar doesn't change until it lands, and letting it go anywhere else changes nothing. The cursor holds a Held Skill or a Held Item, never both.
_Avoid_: Dragged Skill, cursor Skill

**Minion**:
A creature on the Hero's side, brought by a Skill, that fights Monsters for the Hero.
_Avoid_: Pet, summon, ally (and never a Monster: Monsters are always hostile)

**Golem**:
The Minion summoned by the Golem Skill: the Hero has at most one, which follows them through Exits and Town Portals, never regains Life, leaves no Corpse, and is gone on the Hero's Death or when the Save is loaded. Casting the Skill again replaces it.
_Avoid_: Golum

**Curse**:
A mark a Skill puts on every Monster in a circle where it is cast, for a while; a Monster has at most one, a new one replacing the old, and one Returning loses it on reaching home. Amplify Damage's makes the Monster take more damage from everything, Weaken's makes it deal less, Leaden Limbs' makes it walk and swing or shoot more slowly, and Dread's sets it Fleeing.
_Avoid_: Debuff, hex

**Fleeing**:
A Monster under Dread's Curse running away from the Hero without attacking, even when hit, until the Curse ends and it comes back to the fight.
_Avoid_: Fear, routing, Returning (that's going home)

**Raised Skeleton**:
The Minion the Raise Skeleton Skill raises from a Corpse, using it up, whatever Monster the Corpse was. The Hero has a few at once, more at a higher Skill Level, raising one more past that replacing the oldest; otherwise it follows the Golem's rules. Never just "Skeleton": that is the Monster.
_Avoid_: Skeleton (that's the Monster), skelly, undead

**Raised Archer**:
The Minion the Raise Archer Skill raises from a Corpse, which shoots Arrows; the Hero has a few of them, counted apart from Raised Skeletons, by the same rules. Never just "Archer": the Skeleton Archer is a Monster.
_Avoid_: Archer, Skeleton Archer (that's the Monster), skeletal mage

**Bone Wall**:
The short line of bone the Bone Wall Skill raises where it is cast, standing for a while as Props with Life: no one can walk through it, Hero and Minions included, a Monster's Projectile stops at it, Muck aside, and the Hero's flies through, and a Monster that can't reach the Hero breaks it with attacks.
_Avoid_: Barricade, Bone Prison

**Bone Ward**:
What the Bone Ward Skill puts on the Hero: an amount of damage it soaks up before their Life, until used up; casting it again fills it back up. A hit it soaks whole is still a hit, not a Miss: the Hero has taken it, so it keeps them In Combat and can flinch them, though their Life is untouched. It stays on through Exits and Town Portals and is gone on the Hero's Death or when the Save is loaded.
_Avoid_: Bone Armor (Armour is an Item), shield, barrier

**Attack Rating**:
How accurate a Hero's or Monster's attacks are (the Hero's raised by Dexterity); set against the target's Defense it gives the chance to hit.
_Avoid_: Accuracy, to-hit

**Defense**:
How hard the Hero or a Monster is to hit, set against the attacker's Attack Rating; the Hero's comes from their Equipped Helm, Armour, Gloves, Boots and Shield.
_Avoid_: Armor (that's the Item), AC, evasion

**Miss**:
A swing that plays out in full but deals no damage because it failed its chance to hit.
_Avoid_: Dodge, whiff

**Damage Type**:
The kind of a share of damage: Physical, or one of the Elements. One hit can carry several Damage Types, each reduced on its own, and Life loses their sum.
_Avoid_: Damage school, element (when Physical is meant)

**Physical**:
The Damage Type of weapon blows, arrows and bone. The Hero has no Resistance to it: Defense, which decides whether they are hit at all, is their guard against it.
_Avoid_: Normal damage, plain damage

**Element**:
Fire, Cold or Lightning: the Damage Types that a Resistance reduces.
_Avoid_: Magic, elemental type

**Resistance**:
How much of one Element's damage the Hero, a Monster or a Minion shrugs off once a hit has landed, given as a percentage, before Bone Ward soaks up anything and before Amplify Damage adds to it. It can be negative, adding to the damage. The Hero's starts at 0%, comes only from Affixes and never helps their Minions; each Monster type and Minion kind has its own, the same at every Monster Level and always below 100%. Only the Hero's is shown, in the Hero panel. It is what makes the Hero hunt for gear as the game gets harder.
_Avoid_: Resist, res, elemental defense, immunity

**Maximum Resistance**:
The most of one Element's damage a Resistance can take off the Hero's hits, 75%. Resistance above it still counts toward the Hero's total, shown as capped, so a Resistance Penalty eats into the excess first.
_Avoid_: Resist cap, max res

**Resistance Penalty**:
What each Act past the first takes off every one of the Hero's Resistances while they are in it; the Hero panel shows Resistances with it already taken off. Act 1 has none.
_Avoid_: Difficulty penalty, curse (that's a Skill's mark)

**Projectile**:
Something loosed by an attack or a Skill that flies in a straight line through an Area until it meets a wall or runs out of range, Muck aside. A Monster's hits the first Hero or Minion it touches and flies through Monsters; the Skeleton Archer's is the Arrow. The Hero's flies through Minions and hits every Monster on its way, each once; Bone Spear's is one, and Splinter Volley looses a fan of them at once, each hitting on its own.
_Avoid_: Missile, bullet, shot

**Muck**:
The Bog Spitter's Projectile: lobbed over Props and Walls alike at where the Hero stood when it was loosed, its landing spot marked on the ground from then on, it hits every Hero and Minion within a small circle there when it lands, and nothing on the way. Its damage is Cold.
_Avoid_: Glob, spit, bomb

**Slam**:
The Wockbrute's attack: after a long wind-up that hitting it can't stop, it hits every Hero and Minion within a circle around it, whichever way it faces; never Monsters.
_Avoid_: Stomp, smash, area attack

**Gravefire**:
Grave Wockington's attack: lobbed like Muck at where the Hero stood, its landing spot marked from then on, it burns there as a circle for a few seconds, hurting every Hero and Minion inside it a little at a time; never Monsters. Its damage is Fire.
_Avoid_: Fireball, fire patch, burning ground

**Save**:
The Hero's kept progress (Level, Experience, Attributes, unspent Attribute Points, Skill Levels, unspent Skill Points, the Skill Bar, Belongings and Gold), written whenever it changes; there is only one, and loading it starts the Hero in Town.
_Avoid_: Save file, slot, profile, checkpoint

**Item**:
A thing the Hero can pick up, carry in the Inventory and, if it fits a slot, Equip; each Item has a fixed size in Inventory cells, its type's own bonuses, and those of its Affixes.
_Avoid_: Loot, gear, object

**Short name**:
A one-line name an Item type also has, short enough to read inside the Item's box in the panels and the Belt strip where the full name won't fit; the tooltip still gives the full name.
_Avoid_: Abbreviation, label, nickname

**Ground Item**:
An Item lying in an Area, dropped by a Monster or by the player, until the Hero picks it up or the Session ends.
_Avoid_: Drop, loot

**Rarity**:
How special an Item is: Normal, Magic or Rare, its name shown in that Rarity's colour.
_Avoid_: Quality, tier, grade, colour

**Normal**:
The Rarity of an Item with no Affixes, only its type's own bonuses, its name shown in white; every Potion is Normal.
_Avoid_: White, common, plain

**Magic**:
The Rarity of an Item with one or two Affixes, at most one a Prefix and one a Suffix, named for them around its type's name; its name is shown in blue.
_Avoid_: Blue, enchanted

**Rare**:
The Rarity of an Item with three or four Affixes, at most two Prefixes and two Suffixes, given a random two-word name over its type's name; its name is shown in yellow.
_Avoid_: Yellow, epic

**Affix**:
An extra bonus a Magic or Rare Item rolled when it dropped, always shown, never two of one kind on an Item; how strong it can roll grows with the Monster Level of what dropped it, and its name says how strong it is, as *of the Badger* is weaker than *of the Bear*.
_Avoid_: Mod, enchantment, property, stat

**Prefix**:
An Affix whose name goes before the Item's, as in *Sturdy* Chain Mail.
_Avoid_: Prefix mod

**Suffix**:
An Affix whose name goes after the Item's, as in Chain Mail *of the Bear*.
_Avoid_: Suffix mod

**Gold**:
The money the Hero earns from kills and selling Items and spends at the Vendor; it is one amount, carried apart from the Inventory, and the Save keeps it.
_Avoid_: Coins, money, currency

**Gold Pile**:
Gold lying in an Area, dropped by a Monster and labelled with its amount, until the Hero picks it up just by walking near it or the Session ends; it is never the Item in Reach, never shown on the Map Overlay or Mini Map, and the Save never keeps one.
_Avoid_: Gold drop, coins

**Vendor**:
Trader, the NPC in Town who sells the Hero Items for Gold and buys the Hero's Items for Gold. They always have every Potion, and a few Normal Weapons, Shields, Helms, Armour, Gloves, Boots and Belts that change each time the Hero comes back to Town; never a Magic or Rare Item.
_Avoid_: Shop, merchant, store

**Value**:
What an Item is worth in Gold, set by its type and raised by its Rarity and Affixes: the Vendor sells it for its Value and buys it for a quarter of that.
_Avoid_: Price, cost, worth

**Vendor panel**:
The panel opened by picking Trade in the Vendor's Dialogue panel, showing the Vendor's goods and the Hero's Inventory together; Equipped Items aren't in it. A good lifted as the Held Item is bought, its Value taken from Gold, when put down in the Inventory or a Belt Column; one the Hero can't afford can't be lifted. A Held Item of the Hero's, from the Inventory or a Belt Column, put down on the Vendor's side is sold at once and is gone. The World plays on while it is open; it shuts as the Inventory panel does, when the Hero walks away, and when another panel opens, a held good going back to the Vendor at no cost.
_Avoid_: Shop screen, trade window, store

**Inventory**:
The Hero's grid of cells holding the Items they carry but have not Equipped; Items take up rectangles of cells and can't overlap.
_Avoid_: Bag, backpack, stash (and never the Equipment slots or Belt Columns)

**Equipment**:
The Hero's slots for worn Items: Weapon, Off-hand, Helm, Armour, Gloves, Boots, Belt, two Rings and an Amulet; an Item in one of them is Equipped and its bonuses count.
_Avoid_: Gear, paper doll, loadout

**Belongings**:
Everything the Hero owns: the Items in their Inventory, Equipment and Belt Columns together, a Held Item counting as back where it was lifted from; what the Save keeps besides progress.
_Avoid_: Gear, loot, possessions

**Held Item**:
The one Item the player has lifted onto the cursor to move; it still counts as where it was lifted from until it's put down.
_Avoid_: Cursor Item, dragged Item

**Drag**:
Lifting a Held Item or Held Skill and putting it down in one press, the mouse button or a finger held down from where it's lifted to where it's let go, which then acts just as a second click or tap there would: putting down, swapping, dropping into the World, selling or landing in a Skill Bar slot. Either way of moving works everywhere, click and click or Drag, except the Belt strip on a touch screen, which only drinks. A Drag let go over where it was lifted from keeps it held for a mouse, but puts it back for a finger; a finger already holding something puts it down where it lifts.
_Avoid_: Drag and drop, swipe

**Weapon**:
The Item kind Equipped in the Weapon slot, setting the Hero's damage: Physical, plus any Elements its Affixes add, which count for the Hero's attacks and never for a Skill's damage. Every Weapon is held in one hand, leaving the Off-hand free.
_Avoid_: Sword (that's one Weapon), main hand

**Off-hand**:
The Equipment slot for the Hero's other hand, holding a Shield or a Wand, or nothing, whatever the Weapon slot holds.
_Avoid_: Left hand, second hand, offhand

**Shield**:
The Item kind Equipped in the Off-hand to guard the Hero: it gives Defense and a chance to Block, its type's own chance plus what its Affixes add, never above a fixed cap.
_Avoid_: Buckler (that's one Shield)

**Block**:
A hit on the Hero that their Shield stops: any Monster's blow, arrow or spell, Physical or Element. Like a Miss it is not a hit: it does no damage, never flinches the Hero and leaves Bone Ward untouched, though it keeps them In Combat, and it is shown as a Miss is.
_Avoid_: Parry, guard

**Attack Speed**:
How much faster than the base the Hero swings, in percent, from the Attack Speed Affixes on their Equipped Items (Gloves roll it). The swing and the moment its hit lands both come sooner; the Hero panel shows the line only while it is above 0%.
_Avoid_: Attack rate, swing speed, haste

**Walk Speed**:
How much faster than the base the Hero walks, in percent, from the Walk Speed Affixes on their Equipped Items (Boots roll it). The Hero panel shows the line only while it is above 0%.
_Avoid_: Move speed, run speed, movement speed

**Wand**:
A Weapon that also fits the Off-hand. It gives little attack damage but maximum Mana, and each of some of its Affixes raises the Skill Level of one Skill, cast or Passive, picked when it dropped; all of that counts in either slot, so a Hero can hold two.
_Avoid_: Staff, rod, focus

**Armour**:
The Item kind Equipped in the Armour slot, giving the Hero Defense.
_Avoid_: Armor, body armour, chest

**Helm**:
The Item kind Equipped in the Helm slot, giving the Hero Defense that adds to their Armour's.
_Avoid_: Helmet, hat, head armour

**Gloves**:
The Item kind Equipped in the Gloves slot, giving the Hero Defense; their Affixes can make the Hero attack faster.
_Avoid_: Gauntlets (that's one pair), hands

**Boots**:
The Item kind Equipped in the Boots slot, giving the Hero Defense; their Affixes can make the Hero walk faster.
_Avoid_: Greaves (that's one pair), feet, shoes

**Potion**:
An Item the Hero drinks, used up in the drinking; the Hero can drink one anywhere, Town included, but never during Death, and never gives one to a Minion.
_Avoid_: Flask, consumable

**Life Potion**:
The Potion that gives back a fixed amount of Life over a few seconds.
_Avoid_: Health potion, healing potion

**Mana Potion**:
The Potion that gives back a fixed amount of Mana over a few seconds.
_Avoid_: Energy potion

**Rejuvenation Potion**:
The Potion that at once gives back a share of both the Hero's maximum Life and maximum Mana.
_Avoid_: Rejuv, full potion

**Belt**:
The Item kind Equipped in the Belt slot; how many rows it has sets how many Potions each Belt Column holds, one row with no Belt Equipped.
_Avoid_: Sash (that's one Belt), potion bar, quickbar

**Belt Column**:
One of the four stacks of Potions the Hero carries ready to drink, filled from the bottom; each has its own button (a key, a D-pad direction, or its square on the Belt strip on a touch screen), which drinks the bottom Potion and lets the rest drop down a row. Only Potions go in one, of any type, mixed.
_Avoid_: Belt slot (a slot is Equipment), potion slot

**Belt strip**:
The row of squares on the HUD beside the Skill Bar, one per Belt Column, each showing that column's bottom Potion, its key and how many Potions it holds; a Potion can be lifted from it or put down on it as a Held Item, Inventory panel open or not, except on a touch screen, where tapping a square drinks from its column.
_Avoid_: Potion bar, quickbar

**Town Portal button**:
The round button on the HUD after the Panel buttons, a little smaller than they are, that opens a Town Portal, as its key and a controller's LB do; clicking or tapping it is the same, and it shows greyed out in Town and does nothing during Death.
_Avoid_: Portal button, recall button

**Close button**:
The × in the top-right corner of every panel; clicking it shuts that panel just as its key does, so shutting the Inventory panel puts a Held Item back where it was lifted from.
_Avoid_: X button, exit button

**Panel button**:
One of the four buttons on the HUD right of the Skill Bar, one each for the Hero, Inventory, Skill Tree and Quest panels; clicking or tapping it opens or shuts that panel just as its key does, it shows lit while its panel is open, and it does nothing during Death.
_Avoid_: Menu button, mini-panel, HUD button

**Points mark**:
The gold "+" on the corner of the Hero panel's Panel button while the Hero has unspent Attribute Points not yet put down as Pending Attribute Points, and on the Skill Tree panel's while they have unspent Skill Points. It shows with the panel open or shut, dims with its button during Death, and that button's tooltip then says how many points are left to spend.
_Avoid_: Badge, notification dot, level-up indicator

**Level Up button**:
The "Level Up" button above the Life orb, its edge pulsing, shown while the Hero has unspent Attribute Points or Skill Points; clicking or tapping it opens the Hero panel for Attribute Points and the Skill Tree panel for Skill Points (only the Hero panel in the Compact Layout when both are unspent), and it does nothing during Death.
_Avoid_: Points mark (that's on the Panel buttons), level-up indicator

**UI Scale**:
How big the HUD and panels are drawn, following the screen's height within limits, so they read the same on a phone, a tablet and a desktop.
_Avoid_: Zoom (that's the World), DPI, resolution

**World zoom**:
How big the World is drawn, following the screen's height within limits, so about as many tiles show top to bottom on a phone as on a desktop. The 3D World, the Mini Map and the Map Overlay all draw at the same angle.
_Avoid_: Camera zoom, UI Scale (that's the HUD and panels), scale

**3D World**:
The World as the player sees it: the Area, its characters and effects drawn in 3D under a fixed isometric camera, with the HUD and panels drawn over it. It is the only way the World is drawn.
_Avoid_: 3D mode, renderer, graphics mode

**Compact Layout**:
How the HUD and panels are arranged on a short screen, such as a phone held sideways: one panel at a time, filling the screen, opening another shuts it.
_Avoid_: Mobile layout, small mode

**Target**:
The Monster that auto-aim has picked for the Hero when there is no cursor, with a controller or touch: the nearest one within reach, and while the stick walks the Hero, the nearest one within reach ahead of where it walks. Attacks go to it and Skills are cast at it; it is shown as a hovered Monster is.
_Avoid_: Lock-on, focus (that's in panels), aim

**Item in Reach**:
The nearest Ground Item close enough to the Hero for a controller's A or the attack button to pick up, when there is no Target; a Target always comes first, and so does an NPC within talking reach, which A talks to instead. There is none while a panel is open, during Death, or with mouse and keyboard as the Active Input. It is shown as a hovered Item is, and stays the Item in Reach even when it won't fit, the pickup then leaving it lying as a click on it would.
_Avoid_: Target (that's a Monster), targeted Item, pickup target

**Focus**:
The one cell, slot or button picked in an open panel when there is no cursor, with a controller; it is what lifting, putting down and pressing act on, and its Item shows its tooltip.
_Avoid_: Selection, highlight, Target (that's a Monster)

**Virtual Stick**:
The on-screen stick, bottom left on a touch screen, that walks the Hero the way a controller's left stick does.
_Avoid_: Joystick, d-pad, thumbstick

**Touch controls**:
What a touch screen plays the World with, standing in for a controller: the Virtual Stick, the attack button, the Skill buttons and the pause button. They take touches only during play: never on the Start Screen, the Loading Screen or the Hero's Death.
_Avoid_: On-screen controls, virtual gamepad, overlay

**Attack button**:
The round touch button over the Mana orb that does what a controller's A does: attack the Target, else pick up the Item in Reach. It reads "Pick up" while there is an Item in Reach and "Attack" otherwise.
_Avoid_: Fire button, A button, pickup button

**Skill button**:
A button that casts one Skill Bar slot's Skill: X, Y, B, RB or RT on a controller, or on a touch screen one of the five round buttons over the attack button.
_Avoid_: Spell button, action button

**Pause button**:
The touch button that opens the pause menu as Esc and Menu do: top right below the Mini Map, or, while a panel is open, at the top centre under the nameplate (in the Compact Layout, below the Town Portal button).
_Avoid_: Menu button (that's the controller's), settings button

**Long press**:
A touch held still on an Item or Skill for a moment, which shows its tooltip instead of lifting it; lifted without moving, it lifts nothing, but moving it at any time starts a Drag and hides the tooltip.
_Avoid_: Hold, press and hold, hover

**Touch hit area**:
The area around a small button, such as a ×, a Panel button, the pause button or a panel's + and −, that a touch presses it from: grown toward 44 CSS px square, whatever the UI Scale, as far as the halfway rule and its panel allow. A mouse presses only the button as drawn. A cell in a grid (Inventory, Equipment slots, Belt, Vendor) can't grow, since its neighbours meet it halfway, so it is never drawn smaller than 20 CSS px instead.
_Avoid_: Tap target, hitbox, touch zone

**Halfway rule**:
Where a touch hit area stops: halfway to any other button, slot or cell beside it, so the two meet on one line and a touch between them goes to the nearer. Nothing loses a touch on itself as drawn, nor an open panel a touch inside it.
_Avoid_: Snapping, nearest-target

**Loading Screen**:
What shows from the moment the game is opened until all of the 3D World has loaded: the game's name and a bar filling as it loads; if loading fails, it says so and offers Retry. It gives way to the Start Screen.
_Avoid_: Preloader, splash, loader

**Start Screen**:
What shows once loading is done, before play: the Town with its NPCs standing idle, no Hero and no HUD, the camera drifting slowly over it, and the choices Continue (only when there is a Save), New Hero (confirmed first when it would replace the Save) and the Fullscreen button. Continue or New Hero puts the Hero at Town's `start` Entry, as on any arrival. The pause menu's Quit to Start Screen comes back to it at once: the Save keeps everything it keeps, and nothing else carries over.
_Avoid_: Title screen, main menu, menu (that's the pause menu), Hero select

**Rotate Notice**:
What shows instead of the game when the screen is held upright or is too small to play on, asking the player to turn it, or, when too small, to enlarge the window or, on a touch screen, saying the screen is too small and offering the Fullscreen button where it's shown; the World is paused while it shows.
_Avoid_: Orientation warning, portrait screen

**Fullscreen button**:
The item in the pause menu and on the Start Screen, and on the Rotate Notice when the screen is too small, that puts the game in or out of fullscreen, holding it sideways while fullscreen; shown only where the browser allows fullscreen, and never in the Installed game.
_Avoid_: Maximise button

**Installed game**:
The game opened from its icon on the home screen or desktop instead of in a browser tab; it plays the same, without the browser around it. On iPhone and iPad it keeps a Save of its own, apart from the browser's.
_Avoid_: PWA, app, standalone, home-screen app

**Active Input**:
The way the player last played, mouse and keyboard, controller or touch, which decides what the game shows: touch controls only for touch, and each hint and tooltip naming that way's buttons. It starts as touch on a device whose main pointer is a finger, and as mouse and keyboard otherwise. A controller disconnecting while it is the Active Input opens the pause menu.
_Avoid_: Input mode, device, control scheme
