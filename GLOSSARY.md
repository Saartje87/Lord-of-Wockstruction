# Wiablo

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

**Exit**:
A zone in an Area that, when the Hero walks into it, takes the Hero to an Entry in another Area.
_Avoid_: Portal, door, transition, warp

**Entry**:
A named place in an Area where the Hero appears on arriving; the Entry named `start` is where the Hero begins.
_Avoid_: Spawn point (that's for Monsters), arrival

**Area Banner**:
An Area's display name, shown across the screen for a few seconds whenever the Hero arrives in an Area, Town included; it never shows an Area Level.
_Avoid_: Title card, zone text, toast

**Monster**:
A hostile creature that attacks the Hero and their Minions and can be killed.
_Avoid_: Enemy, mob, NPC

**Monster Level**:
How strong a Monster is: the same Monster type is tougher, hits harder and gives more Experience at a higher Monster Level.
_Avoid_: Level (that's the Hero's), tier, difficulty

**Leash**:
How far a Monster will chase the Hero or their Minion from where it was placed before it gives up and starts Returning.
_Avoid_: Tether, chase range, aggro range

**Returning**:
A Monster walking back to where it was placed after giving up on the Hero or their Minion, ignoring both on the way and healing to full on arrival; it happens past the Leash or on the Hero's Death.
_Avoid_: Resetting, evading, retreating

**NPC**:
A non-hostile character in Town.
_Avoid_: Villager, townsperson

**Life**:
The Hero's or a Monster's health; reaching zero means death.
_Avoid_: HP, health

**Death**:
The Hero's state once their Life reaches zero: they lie where they fell, and Monsters and their Projectiles leave them be, until the player sends them back to Town.
_Avoid_: Game over, defeat

**In Combat**:
The Hero's state while they have dealt or taken damage in the last few seconds, or while a Monster is chasing them or their Minion; outside it, the Hero slowly regains Life.
_Avoid_: Aggro, engaged

**Corpse**:
What remains of a dead Monster, lying in its Area until the Hero leaves.
_Avoid_: Body, remains

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
Something the Hero casts, spending Mana; it can't be cast in Town. Every Hero can learn the same Skills, from the one Skill Tree.
_Avoid_: Spell, ability, power

**Skill Tree**:
All the Skills the Hero can learn, and how far each has been learned.
_Avoid_: Talent tree, spellbook

**Skill Point**:
What the Hero gains one of on each new Level, kept until the player spends it to raise a Skill's Skill Level by one; a spent point can't be taken back.
_Avoid_: Talent point

**Skill Level**:
How far the Hero has learned a Skill: 0 until the first Skill Point is spent on it, when it can first be cast; each higher Skill Level makes it stronger.
_Avoid_: Rank (and never the Hero's Level)

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
The Minion summoned by the Golem Skill: the Hero has at most one, which follows them through Exits, never regains Life, leaves no Corpse, and is gone on the Hero's Death or when the Save is loaded. Casting the Skill again replaces it.
_Avoid_: Golum

**Attack Rating**:
How accurate a Hero's or Monster's attacks are (the Hero's raised by Dexterity); set against the target's Defense it gives the chance to hit.
_Avoid_: Accuracy, to-hit

**Defense**:
How hard the Hero or a Monster is to hit, set against the attacker's Attack Rating; the Hero's comes from their Equipped Armour.
_Avoid_: Armor (that's the Item), AC, evasion

**Miss**:
A swing that plays out in full but deals no damage because it failed its chance to hit.
_Avoid_: Dodge, whiff

**Projectile**:
Something loosed by an attack that flies in a straight line through an Area until it hits the first Hero or Minion it touches, meets a wall, or runs out of range; it flies through Monsters. The Skeleton Archer's is the Arrow.
_Avoid_: Missile, bullet, shot

**Save**:
The Hero's kept progress (Level, Experience, Attributes, unspent Attribute Points, Skill Levels, unspent Skill Points, the Skill Bar and Belongings), written whenever it changes; there is only one, and loading it starts the Hero in Town.
_Avoid_: Save file, slot, profile, checkpoint

**Item**:
A thing the Hero can pick up, carry in the Inventory and, if it fits a slot, Equip; each Item has a fixed size in Inventory cells and fixed bonuses.
_Avoid_: Loot, gear, object

**Short name**:
A one-line name an Item type also has, short enough to read inside the Item's box in the panels and the Belt strip where the full name won't fit; the tooltip still gives the full name.
_Avoid_: Abbreviation, label, nickname

**Ground Item**:
An Item lying in an Area, dropped by a Monster or by the player, until the Hero picks it up or leaves the Area.
_Avoid_: Drop, loot

**Inventory**:
The Hero's grid of cells holding the Items they carry but have not Equipped; Items take up rectangles of cells and can't overlap.
_Avoid_: Bag, backpack, stash (and never the Equipment slots or Belt Columns)

**Equipment**:
The Hero's slots for worn Items: Weapon, Armour, Belt, two Rings and an Amulet; an Item in one of them is Equipped and its bonuses count.
_Avoid_: Gear, paper doll, loadout

**Belongings**:
Everything the Hero owns: the Items in their Inventory, Equipment and Belt Columns together, a Held Item counting as back where it was lifted from; what the Save keeps besides progress.
_Avoid_: Gear, loot, possessions

**Held Item**:
The one Item the player has lifted onto the cursor to move; it still counts as where it was lifted from until it's put down.
_Avoid_: Cursor Item, dragged Item

**Weapon**:
The Item kind Equipped in the Weapon slot, setting the Hero's damage.
_Avoid_: Sword (that's one Weapon)

**Armour**:
The Item kind Equipped in the Armour slot, giving the Hero Defense.
_Avoid_: Armor, body armour, chest

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

**Close button**:
The × in the top-right corner of the Hero, Inventory and Skill Tree panels; clicking it shuts that panel just as its key does, so shutting the Inventory panel puts a Held Item back where it was lifted from.
_Avoid_: X button, exit button

**Panel button**:
One of the three buttons on the HUD right of the Skill Bar, one each for the Hero, Inventory and Skill Tree panels; clicking or tapping it opens or shuts that panel just as its key does, it shows lit while its panel is open, and it does nothing during Death.
_Avoid_: Menu button, mini-panel, HUD button

**UI Scale**:
How big the HUD and panels are drawn, following the screen's height within limits, so they read the same on a phone, a tablet and a desktop.
_Avoid_: Zoom (that's the World), DPI, resolution

**World zoom**:
How big the World is drawn, following the screen's height within limits, so about as many tiles show top to bottom on a phone as on a desktop, each of the art's pixels covering a whole number of the screen's where it can.
_Avoid_: Camera zoom, UI Scale (that's the HUD and panels), scale

**Compact Layout**:
How the HUD and panels are arranged on a short screen, such as a phone held sideways: one panel at a time, filling the screen, opening another shuts it.
_Avoid_: Mobile layout, small mode

**Target**:
The Monster that auto-aim has picked for the Hero when there is no cursor, with a controller or touch: the nearest one ahead of the Hero within reach. Attacks go to it and Skills are cast at it; it is shown as a hovered Monster is.
_Avoid_: Lock-on, focus (that's in panels), aim

**Focus**:
The one cell, slot or button picked in an open panel when there is no cursor, with a controller; it is what lifting, putting down and pressing act on, and its Item shows its tooltip.
_Avoid_: Selection, highlight, Target (that's a Monster)

**Virtual Stick**:
The on-screen stick, bottom left on a touch screen, that walks the Hero the way a controller's left stick does.
_Avoid_: Joystick, d-pad, thumbstick

**Touch controls**:
What a touch screen plays the World with, standing in for a controller: the Virtual Stick, the attack button, the Skill buttons and the pause button.
_Avoid_: On-screen controls, virtual gamepad, overlay

**Attack button**:
The round touch button over the Mana orb that does what a controller's A does: attack the Target, else pick up a Ground Item near the Hero.
_Avoid_: Fire button, A button

**Skill button**:
A button that casts one Skill Bar slot's Skill: X, Y, B, RB or RT on a controller, or on a touch screen one of the five round buttons over the attack button.
_Avoid_: Spell button, action button

**Pause button**:
The touch button that opens the pause menu as Esc and Menu do: top right, or, while a panel is open, after the Panel buttons.
_Avoid_: Menu button (that's the controller's), settings button

**Long press**:
A touch held still on an Item or Skill for a moment, which shows its tooltip instead of lifting it.
_Avoid_: Hold, press and hold, hover

**Touch hit area**:
The area around a small button, such as a ×, a Panel button, the pause button or a panel's + and −, that a touch presses it from: grown toward 44 CSS px square, whatever the UI Scale, as far as the halfway rule and its panel allow. A mouse presses only the button as drawn.
_Avoid_: Tap target, hitbox, touch zone

**Halfway rule**:
Where a touch hit area stops: halfway to any other button, slot or cell beside it, so the two meet on one line and a touch between them goes to the nearer. Nothing loses a touch on itself as drawn, nor an open panel a touch on its body.
_Avoid_: Snapping, nearest-target

**Rotate Notice**:
What shows instead of the game when the screen is held upright or is too small to play on, asking the player to turn it, or, when too small, to enlarge the window or, on a touch screen, saying the screen is too small and offering the Fullscreen button; the World is paused while it shows.
_Avoid_: Orientation warning, portrait screen

**Fullscreen button**:
The item in the pause menu, and on the Rotate Notice when the screen is too small, that puts the game in or out of fullscreen, holding it sideways while fullscreen; shown only where the browser allows fullscreen.
_Avoid_: Maximise button

**Active Input**:
The way the player last played, mouse and keyboard, controller or touch, which decides what the game shows: touch controls only for touch, and each hint and tooltip naming that way's buttons. A controller disconnecting while it is the Active Input opens the pause menu.
_Avoid_: Input mode, device, control scheme
