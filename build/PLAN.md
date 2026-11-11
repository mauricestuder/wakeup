# High Ground: build / edit / aim trainer (v1 = box-fight arena, feel test)

## Context

`mauricestuder/wakeup` is a static GitHub Pages site: the WakeUp alarm app at the root plus two
games in their own folders (`game/` = Cash Out, `ski/` = Fresh Line). Wanted now: a third game, a
fast build / edit / shoot practice game, solo, in the browser, keyboard and mouse. **The first
version is only a small box-fight arena, to find out whether building, editing and shooting feel
good.** Art direction and more modes come after that test.

This is an **original game** in the builder-shooter genre. It uses the same kind of mechanics
(grid pieces, tile edits, hitscan guns) but has its own name, character, visuals, sounds, weapons,
HUD, edit rules and arena. Nothing is copied from Fortnite, so "exactly the same" can't be
promised. Instead every feel number is tunable in-game, so it can be dialled in.

Working title **High Ground** (easy to rename). Folder `build/`, live URL once it is on `main`:
`https://mauricestuder.github.io/wakeup/build/`.

## Where things stand

Done, tested and on the branch `claude/adoring-turing-yowxzy`:

- `build/js/grid.js`: constants (C, L, N, H, wall thickness, roof height), slot keys, `inBounds`,
  lattice edges, the `Support` class (`add`, `remove`, `supported`, `floating`, `depths`), ray
  walks (`wallCrossings`, `levelCrossings`), `cellOf`, `facing`.
- `build/js/tuning.js`: `DEFS` (47 feel numbers with label, range, step, default), the live
  values `T`, `setTune`, `resetTuning`, `changed` (saved under `highground.tuning`).

Everything else in the file list is still to do. Start with `build/js/pieces.js`, then follow the
build order. This file is a working note: delete it when the game is finished.

The parts marked *(refined)* below were adjusted after the first approval and are the current
rules.

## v1 in short

- Third-person character in a small walled arena (7 × 7 cells), starting inside a 1×1 box.
- Four pieces: wall, floor, ramp, roof (pyramid). Preview ghost, instant placement, hold to keep
  building. Pieces need support and collapse when they are cut off.
- Editing: walls 3×3 tiles, floors 2×2 tiles. The tiles you select are removed. Reset, optional
  confirm on release. Ramps rotate.
- Three hitscan guns (shotgun, rifle, SMG). Pieces have HP and break. Hit markers, damage numbers.
- Three practice dummies: one strafing in the open, one on a small tower, one inside an "enemy"
  box that re-places a broken wall after a short delay (to practise taking a wall).
- Settings: sensitivity (plus build / edit multipliers), FOV, camera distance, volume, and full
  rebinding of keys, mouse buttons and wheel.
- **Feel lab**: sliders for every movement / build / edit / gun number, saved on the device, with
  "copy my values" so good values can become the defaults.
- One key resets the arena instantly.

## Files (all new, no existing file changes)

```
build/
  index.html            canvas, HUD, menu / pause / settings screens (inline CSS, like game/index.html)
  manifest.webmanifest, sw.js, icons/ (4 PNGs, generated with a scratchpad script)
  js/main.js            boot, renderer, fixed-step loop, screens, pointer lock, modes (gun / build / edit)
  js/tuning.js          every feel number + defaults, load / save of overrides
  js/grid.js            pure grid math, no THREE import: slot keys, edges, support search, ray walk
  js/pieces.js          piece store: add / remove / edit masks, HP, collapse, meshes
  js/collide.js         player-vs-world collision and ray casts
  js/player.js          controller, character model, camera rig
  js/build.js           target selection, ghost, placing
  js/edit.js            tile selection, confirm / reset
  js/weapons.js         guns, spread, reload, damage
  js/targets.js         dummies, enemy-box behaviour
  js/arena.js           map layout, reset
  js/input.js           action ↔ key / mouse binding, rebinding, key labels
  js/settings.js        options + settings / controls / Feel lab UI
  js/hud.js, js/audio.js
```

Three.js r160 is shared, not copied: `import * as THREE from '../../game/vendor/three.module.min.js'`
(same as `ski/js/*`). Saves use the localStorage prefix `highground.`.

## Rules

**Grid.** Cell width C = 4 m, level height L = 3 m, arena N = 7 cells, build height 5 levels.
Slots: `f:i,k,j` floor panel at y = k·L (k ≥ 1, level 0 is the arena ground) · `wx:i,k,j` wall in
plane x = i·C · `wz:i,k,j` wall in plane z = j·C · `r:i,k,j` ramp (+ rise direction 0–3) ·
`c:i,k,j` roof. A cell can hold one of each. Piece =
`{type, i, k, j, dir, owner: 'me'|'enemy'|'map', hp, mask}`; `mask` is the bitmask of solid tiles
(wall 9, floor 4).

**Support.** Lattice edges `ex / ez / ey`. Floor and roof use the 4 edges of their base square, a
wall its bottom, top and 2 vertical edges, a ramp the 8 horizontal edges of its cell. A slot is
supported if one of its edges lies on the ground or is used by an existing piece. After any
removal: flood-fill from grounded and map pieces, unreached pieces break (staggered by distance).
Edits never change support.

**Placement target**, from the crosshair ray, starting where it passes the player and stopping
at the first solid thing:
- Wall: first empty wall slot whose plane the ray crosses within reach (level = height of the
  crossing). Unsupported → same column, nearest supported level down to feet level. No crossing
  (looking steeply up or down) → the wall on the edge of the player's cell in the facing
  direction at feet level, or the one above it when looking up and the lower one exists.
- Floor: first empty floor slot whose level plane the ray crosses within reach (look up =
  ceiling, look down from height = floor ahead). Fallback: feet-level slot in the own cell, then
  the next cell ahead, then the ceiling above.
- Ramp *(refined)*: the cell at a focus point about 2.2 m along the ray (or just in front of what
  the ray hits). It rises away from the player. Its level follows the surface the player stands
  on: on flat ground the same level, on a ramp going up the next level (so holding the button
  while running makes a staircase), looking down from a ledge gives a ramp leading down. If the
  cell already has a ramp, nothing is placed (no jump to the next cell, otherwise one click with
  hold-to-build could place two). Unsupported → nearest supported level down.
- Roof *(refined)*: a low pyramid, 1.5 m high (same slope as a ramp, so it can be walked over).
  It sits on the ceiling line of the cell at the focus point: look level or up for a roof over
  your head, look down from height for one at your feet. Unsupported → nearest supported level
  down.
- A floor or ramp placed under the player while they are in the air lifts them on top, if there
  is headroom *(refined)*.
- Ghost is translucent, red when invalid. LMB places inside the `mousedown` handler (no frame of
  delay). Holding LMB keeps placing whenever the target changes, also right after switching piece
  type. No cost, 0.05 s repeat (tunable).

**Editing.** Edit key on an own piece in reach, picked by its full unedited outline so holes can
be re-edited; enemy and map pieces block the pick and can't be edited. LMB toggles the tile under
the crosshair, dragging paints, RMB makes everything solid again, the Edit key confirms (or LMB
release when "confirm on release" is on, default off). At least one tile must stay. Wall tiles
are 1.33 × 1 m: one tile = window, 1×2 = door, top two rows = half wall to jump over. Ramp: the
Edit key rotates it. Roof: not editable in v1. Collision, shots and meshes update the moment an
edit confirms.

**Movement and collision.** Player = upright box, half-width 0.4, height 1.8 (crouch 1.2).
Physics runs at a fixed 120 Hz with an accumulator and interpolated rendering; mouse look is
applied per mouse event. Start values: run 5.6 m/s, gravity 26, jump 8.2 (about 1.3 m high),
coyote time 90 ms, jump buffer 100 ms, some air control.
- Walls and floors: one axis-aligned box per solid tile, resolved axis by axis (X, Z, then Y).
  That gives sliding along walls, doors, windows, half walls and standing on wall tops.
- Ramps and roofs: height fields with a thin slab, sampled at the player's centre. From above
  they are ground (step-up 0.75 m, snap-down so walking downhill stays glued). Ramps block like a
  wedge from the side and from below. Roofs are one-way: walkable on top, they stop a jump from
  below, but never block walking underneath.
- Nothing may trap the player: a move is blocked only if it would *start* an overlap. A wall
  placed on the player nudges them to the nearer side, an own ramp lifts them on top when there
  is headroom, otherwise they can simply walk out. Sudden lifts are smoothed in the camera only.

**Camera and input.** Over-the-shoulder third person (distance 3.2 m, tunable), pulled in when
something is behind the player, character fades when the camera gets close. Crosshair ray =
camera ray; shots are re-checked from the character so a hugged wall can't be shot through.
Pointer lock with raw input. Actions are bound by physical key (`event.code`), mouse button or
wheel; labels follow the keyboard layout where the browser can tell.

Default binds, all rebindable: WASD move · Space jump · Left Shift crouch · Q wall · C floor ·
E ramp · V roof · F edit · RMB reset edit · 1 / 2 / 3 guns · R reload · T reset arena · Esc pause.
No Ctrl defaults (Ctrl+W closes the tab), leaving mid-game asks first, side mouse buttons don't
navigate. Touch devices get a "needs keyboard and mouse for now" note.

**Guns and targets.** Hitscan, endless reserve ammo, own names and stats: *Breaker* pump shotgun
(9 pellets), *Ranger* rifle (automatic, spread grows while firing), *Hornet* SMG. Head hits ×1.5,
damage falls off with distance. Piece HP: wall 150, the others 140. Dummies have 200 HP, show a
bar and respawn after 1.5 s. Enemy box: a broken wall is re-placed after about 0.3 s (setting:
off / slow / fast) unless the player got a piece in first. When a dummy respawns, its box or
tower is rebuilt, except where a player piece now sits *(refined)*.

**Arena.** 28 × 28 m grid-lined floor, unbreakable outer walls (5 levels, they count as support),
open sky. Player box at one end, enemy box with a dummy at the other, a strafing dummy in the
middle, one dummy on a small tower. `T` puts everything back instantly.

**Look and sound (placeholder on purpose).** Clean training room: pale grid floor, own pieces as
blue-grey panels with visible tile seams, enemy pieces red-tinted, map walls dark, a simple
box-built character, no shadows or post-processing (frame rate first). All sounds are
synthesised. The real art style gets chosen after the feel test.

## Reused from the repo

| What | From |
|---|---|
| Pointer lock with raw input and fallbacks, mouse-spike filter, `show(id)` screens, fullscreen, resize, `window.__game` hook | `game/js/main.js` (137–193, 263–301) |
| Settings model: `OPTIONS` / `DEFAULTS`, validated localStorage, `initSettingsUI`, `lookSpeed` | `game/js/settings.js` |
| Synth helpers `env`, `tone`, `noise`, compressor + gun bus, gun recipe | `game/js/audio.js` |
| `rayBox` and axis-by-axis sliding (`moveCircle`) as the starting point | `game/js/world.js` (506–566) |
| Hitscan pattern: weapon table, tap-to-fire buffer, disc spread | `game/js/weapons.js` |
| HUD class with cached writes, hit marker, toast | `game/js/hud.js` |
| `makeCanvas` / `canvasTex` for panel and grid textures | `game/js/textures.js` |
| Box-built character (`buildModel`) | `ski/js/skier.js` (33–132) |
| Renderer and light setup, `store` localStorage helper | `ski/js/main.js` |
| Network-first service worker, manifest, icon set | `ski/sw.js`, `ski/manifest.webmanifest`, `ski/icons/` |

Code is copied and adapted into `build/js/` so each game folder stays self-contained. The game
registers its own `sw.js`, because the root one covers the whole site.

## Build order

1. Scaffold: page, renderer, loop, arena floor, player + camera, pointer lock. *(commit, push)*
2. `grid.js`, `pieces.js`, `collide.js`, then `build.js` (targeting, ghost, placing, support,
   collapse), starter layout and reset. *(commit, push)*
3. `edit.js`.
4. Guns, dummies, piece damage, HUD. *(commit, push)*
5. Rebinding, settings, Feel lab, audio, hints, icons / manifest / service worker.
   *(commit, push)*

Work happens on `claude/adoring-turing-yowxzy`. No pull request unless asked. Note: GitHub Pages serves `main`, so the game is playable at the URL above
only after the branch is merged.

Effort: roughly 60–90 minutes of building and testing.

## Verification

Test scripts live in the session scratchpad, not in the repo.

- **Node unit tests for `grid.js`**: slot keys and edges, support and collapse (cut the bottom
  wall of a tower → everything above breaks; a floor hanging off an outer wall stays), ray walk
  order.
- **Headless Chromium (Playwright)** against a local static server at `/build/`: loads with no
  console errors, menu → play works without pointer lock.
- **Scripted play** through real key and mouse events plus `window.__game` (with a manual-step
  mode so physics is deterministic):
  - build: every piece type lands in the expected slot for a set of look directions; holding LMB
    while turning makes a full box; an unsupported target shows invalid and places nothing.
  - collision: walk into a wall (stopped, slides), through an edited door, jump onto a half wall,
    up a ramp onto a floor, under a ramp until the head hits, a ramp placed in the own cell lifts
    the player, a roof over the player doesn't trap them, drop through an edited floor hole.
  - edit: select / confirm / reset, "at least one tile", confirm on release, ramp rotate.
  - guns: a dummy takes damage and respawns, a wall breaks at 0 HP and the pieces above it
    collapse, enemy wall re-place versus the player getting in first, no shot through a hugged
    wall.
  - reset restores the start layout; settings, binds and Feel lab values survive a reload.
- **Screenshots** of the start box, a ramp / floor / wall build, the edit overlay, HUD and
  settings, checked by eye.
- **Regression**: `game/` and `ski/` still load (none of their files change).
- **Not testable by me**: real mouse feel and latency. That is the actual test and it is the
  player's; the Feel lab exists for it.

## Not in v1 (after the feel test)

Final art style and character · roof edits and angled edit shapes · a bot that shoots back and
player health · timed drills (edit course, aim range, build drills) · materials · aiming down
sights · touch and controller · lobby / locker · online 1v1 (needs a server, GitHub Pages alone
can't do it).

## Implementation notes (already worked out)

**Constraints.** Original game: own name, character, palette, HUD, weapon names and sounds, edit
rules and arena. No names, terms, art, sounds or maps from an existing game; UI wording stays
generic ("roof", "hold to build"). No changes to `game/`, `ski/` or the root app. Test scripts
stay out of the repo. No pull request unless asked.

**Coordinates.** x and z run from 0 to 28, y is up. Cell (i, j) covers x in [4i, 4i+4], z in
[4j, 4j+4]; level k covers y in [3k, 3k+3]. Camera: `rotation.set(pitch, yaw, 0, 'YXZ')`,
forward = (-sin yaw, 0, -cos yaw), right = (cos yaw, 0, -sin yaw). Player walls use lines 1 to 6
(lines 0 and 7 are the map walls); floors and roofs use levels 1 to 5; ramps levels 0 to 4.

**Shapes.**
- Wall: 0.2 thick, centred on its plane. Tile (row, col), bit `row * 3 + col`, row 0 at the
  bottom: 1.33 wide, 1 high. For collision the end columns reach 0.1 further so corners close.
- Floor: slab from y = 3k - 0.2 to 3k, four quarters (a, b), bit `a + 2 * b`.
- Ramp: surface from 3k up to 3k + 3 along `dir` (0 = +x, 1 = +z, 2 = -x, 3 = -z), slab 0.25
  thick below the surface.
- Roof: surface 3k + 1.5 * (1 - 2 * max(|x - cx|, |z - cz|) / 4), base at 3k.
- The map walls are not pieces: the player is clamped inside, rays stop at the inner faces up to
  15 m, and `edgeAnchored` in `grid.js` already treats their edges as support.

**Collision** (player = box, half-width 0.4, height 1.8 or 1.2, fixed 1/120 s steps).
- Order per step: push out of walls, move X, move Z, then vertical.
- Boxes (wall and floor tiles): a box blocks a move only if the player did not overlap it before
  the move; then clamp to the face they came from. Boxes whose top is within 0.1 above the feet
  count as ground, not as obstacles.
- A wall placed on the player pushes them to the nearer side along the wall's normal at
  `pushOut` m/s. A floor that overlaps the player is ignored until they are out of it.
- Ramps and roofs are sampled at the player's centre. When the centre enters a cell (or a piece
  appears in it), each ramp or roof there is either "above" (feet at least surface - 0.75) or
  goes into the player's `under` set until the centre leaves the cell. "Above" pieces are ground
  (step up, and snap down 0.3 when walking downhill). "Under" pieces only act as a ceiling; a
  ramp also blocks a sideways move that would newly put its slab into the body. Roofs never block
  sideways.
- Before stepping up a slope, check headroom; if blocked, undo that axis move.
- A ramp or roof placed in the player's cell lifts them on top when there is headroom (ramp up
  to 3 m, roof up to 1.5 m), otherwise it goes into `under`. A floor placed up to 1.3 m above the
  feet lifts them too. The lift is added to a camera offset that fades in about 70 ms.
- Coyote time and jump buffer come from `T`; un-crouching needs headroom.

**Rays.** One cast over all pieces (tile boxes, ramp planes with footprint check, the four roof
faces), dummies (body box and head sphere), the ground and the map walls. It is used for shots,
camera collision, the edit pick (own pieces by full outline) and to cut off build targeting.

**Build targeting.** `tStart` = where the camera ray passes the player's head; the ray is cut at
the first solid hit plus 0.35 m. Levels: walls use floor((y + 1) / 3) as feet level, floors
floor((y + 1.2) / 3). The details per piece are in "Placement target" above. Placing happens in
the `mousedown` handler; while the button is held, place whenever a valid target exists, at most
every `buildRepeat` seconds.

**Modes.** `gun`, `build`, `edit`. A piece key enters build mode, a gun key leaves it, the edit
key starts or confirms an edit and returns to the mode before.

**Camera and loop.** Pivot 1.55 m above the feet (1.15 crouched), offset right `camRight`, up
`camUp`, back by the camera distance setting; pulled in at once when blocked, eased back out.
Fixed 120 Hz physics with an accumulator, rendering interpolates the player position, mouse look
is applied in the `mousemove` handler. Keep a `window.__game` hook with a manual-step switch for
scripted tests. Headless Chromium may need `--enable-unsafe-swiftshader` for WebGL.

**Guns.** Values are in `tuning.js` (prefixes `brk`, `rng`, `hrn`). Shot = camera ray from
`tStart`, then re-checked from the character's chest to the hit point; whatever is hit first
counts. Pieces of any owner take damage. Damage falls off after 7 m (Breaker) and 12 m (Hornet).

**Targets.** Strafing dummy in the middle, one on a one-level enemy tower, one inside the enemy
box. A broken enemy-box wall is put back after the delay from the settings (off, 0.6 s, 0.3 s)
if the slot is still empty. Dummies fall if their floor breaks.

**Arena start layout.** Player box: walls around cell (1, 3) on level 0, owner `me`, player in
the middle facing +x. Enemy box: walls around cell (5, 3) plus a floor on top, owner `enemy`.
Tower: walls around cell (5, 5) plus a floor on top, dummy standing on it.

**Input.** Bind by `event.code`, `Mouse0` to `Mouse4`, `WheelUp`, `WheelDown`. Labels from
`navigator.keyboard.getLayoutMap()` where it exists, otherwise from the code. Block the context
menu and side-button navigation, ask before leaving mid-game, show a note on touch devices.

**PWA.** `sw.js` copied from `ski/sw.js` with the cache name `high-ground`, manifest like
`ski/manifest.webmanifest`, four icons drawn with a script (a wall panel with one tile cut out).
