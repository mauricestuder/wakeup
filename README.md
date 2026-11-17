# WakeUp

An alarm that only stops once you prove you're awake.

Plain HTML/CSS/JS progressive web app – no build step, no dependencies to
install. Works offline once loaded. Designed to be wrapped with Capacitor later
if you ever want it in an app store.

## How it works

1. **Arm** the alarm at night and leave the app open on a plugged-in phone.
   The screen goes almost black (dim mode) and stays on.
2. At alarm time a siren starts quietly and ramps to full volume.
3. Tap **Start challenges** – the siren stops and you work through your
   **chain** (e.g. Math → QR scan).
4. **Anti-cheat**
   - Stop interacting for 60 s (configurable) and the siren comes back at full
     volume. The current step restarts.
   - After the chain a **re-check** fires a few minutes later ("still awake?"
     – one easy sum). Miss it and the whole thing starts over.
   - Disarming requires holding the button for 3 seconds.

### Challenges

| Challenge | What you do | Proves |
|---|---|---|
| **Math** | Solve N problems (3 difficulty levels). Wrong answers swap in a new problem. | You can think |
| **Typing** | Retype a sentence exactly – live green/red feedback, paste blocked. | Fine motor control |
| **QR scan** | Scan a code you printed and stuck in another room. | You left the bed |

## Running it

### On your PC (for trying it out)

```bash
npx --yes http-server -p 8080 -c-1
```

Then open <http://localhost:8080>. Camera and wake lock work on `localhost`
without HTTPS. (Or open it from the Claude desktop app's Browser pane via
`.claude/launch.json`.)

### On your phone (the real use)

The camera only works over **HTTPS**, so host the folder somewhere with a
certificate. GitHub Pages is free and enough:

1. Push this folder to a GitHub repository (this one lives at github.com/mauricestuder/wakeup).
2. Repo → Settings → Pages → Source: `main` branch, folder `/ (root)`.
3. Open `https://mauricestuder.github.io/wakeup/` on your phone.
4. Browser menu → **Add to Home Screen**. Launch it from there – it opens
   full-screen like an app.

### Nightly routine

1. Open WakeUp, check the time, tap **Arm alarm**.
2. Plug the phone in and lay it face-up.
3. Don't close the app. (If the page reloads, the home screen reminds you to
   re-arm – tapping Arm is what unlocks sound on iPhones.)

> **iPhone note:** Safari may still let the screen lock after a while; set
> Settings → Display & Brightness → Auto-Lock to *Never* on alarm nights.

## First-time setup for the QR challenge

Settings → **Set up / print QR code** → Print (or Save image) → stick it on
the bathroom mirror / kitchen cupboard / front door. Regenerate the code any
time; old printouts stop working.

## Settings

All saved automatically in the browser (`localStorage`).

| Setting | Default |
|---|---|
| Chain (up to 3 steps) | Math → QR scan |
| Math problems / difficulty | 3 / medium |
| Typing difficulty | long sentence |
| Alarm resumes after idle | 60 s |
| Re-check | on, 5 min after finishing |
| Start volume / ramp to full | 20 % / 30 s |
| Repeat daily | on (auto re-arms for the next day after you finish) |

**Try it out** buttons in Settings run a single challenge in practice mode, and
**Test alarm in 10 s** runs the whole flow.

## Project layout

```
wakeup/
  index.html          all screens (one <section> each)
  css/style.css
  js/app.js           state machine + screen routing + settings UI
  js/alarm.js         scheduling, Web Audio siren, vibration, wake lock
  js/storage.js       localStorage settings + QR secret
  js/recheck.js       "still awake?" prompt
  js/challenges/      math.js, typing.js, qr.js, index.js (registry)
  js/vendor/          jsQR (decoder), qrcode-generator (printable code)
  sw.js               offline cache – bump CACHE_VERSION when you release
  manifest.json, icons/
```

### Adding a challenge

Create `js/challenges/<name>.js` exporting
`{ id, label, mount(container, settings, { onPass, onActivity }), unmount() }`,
register it in `js/challenges/index.js`, and it appears in the chain selector.
Call `onActivity()` on every user interaction (resets the idle timer) and
`onPass()` when solved.

## Games in this repository

Four browser games live next to the alarm, each in its own folder. No build
step: open the folder's `index.html` through any web server, or on GitHub Pages
at `https://mauricestuder.github.io/wakeup/<folder>/`.

| Folder | Game |
|---|---|
| `game/` | First-person escape shooter with a PS1 look |
| `ski/` | **Fresh Line**: snowboard and ski tricks down ten mountains |
| `build/` | **High Ground**: build, edit and aim trainer |
| `resort/` | **Idle Lift**: idle ski resort tycoon (see below) |

### Idle Lift (`resort/`)

An idle ski resort on a 3D mountain, for phone and PC. The resort runs itself:
guests arrive, queue, ride the lifts and ski down. Your income per second is
worked out from your lifts, guests and prices, and stays the same until you buy
something. You spend the money on wooden upgrade boards.

- **New lift** opens the next of six lifts with its piste. **Upgrade lift**
  turns a lift into a chairlift, then a gondola.
- **Lift speed**, **More guests**, **Ticket price** and **Ski hut** raise the income.
- **Jump park** builds kickers on the pistes. Now and then a skier takes one and
  pays a trick bonus.
- **Snow guns**, **Ski school**, **Night skiing** and **Restaurant** unlock as
  you play (rides sold, minutes played, lifts opened).
- **Rush hour** is a 30 second boost with a 2 minute recharge.
- 26 quests pay bonuses. Three are open at a time; finishing one unlocks the
  next. Tap the quest marker to see them. When every lift is a gondola you move
  to the next of three mountains and all income doubles.
- After lift 3 you can hire **managers** (the Hire button on each board); they buy that
  board by themselves and leave money for the next lift. Tap Manager to pause.
- **Events** every few minutes: Powder day (income x2), Storm (a lift stops until
  you secure it, for a bonus) and Celebrity visit (tap the skier in gold).
- While the game is closed the resort earns half its income for up to 8 hours.
  The **Lodge** board raises both.
- Pistes wind down the mountain in snake curves, with tunnels, wooden bridges,
  mogul fields, a race section with gates and a fun park with rails, a box and a
  halfpipe.
- Guests arrive by car and coach on the valley road. Skiers and snowboarders
  share the pistes. All prices are whole dollars.
- Hold a board to keep buying. Keys 1 to 6 press the first six boards, Space
  starts rush hour.
- Camera: drag moves, pinch or wheel zooms. It does not turn.
- Graphics on Auto lowers the detail by itself when frames come slowly.
- Progress saves in the browser (`localStorage`, key `firstchair.idle`).

```
resort/
  index.html            markup and styling
  js/tuning.js          every balance number: fares, prices, growth, caps
  js/maps.js            the three mountains
  js/terrain.js         heights, slopes, forest              (no rendering)
  js/network.js         shapes of lifts and pistes           (no rendering)
  js/layout.js          where the six lifts go on a mountain (no rendering)
  js/idle.js            the rules: guests, income, buying, milestones, saving (no rendering)
  js/view/              three.js scene, camera, lifts, pistes, buildings, guests, extras
  js/ui.js              money sign, upgrade boards, quest list, pop-ups, notices
  js/audio.js           synthesised sound
  js/main.js            boot and game loop
```

The modules marked "no rendering" import nothing from three.js or the page, so
the rules can be run in plain Node to test balance changes.

## Known limits of the PWA approach

- The phone's browser must stay open and in the foreground all night. Closing
  the tab means no alarm. This is the trade-off for needing no app store.
- Volume is capped by the phone's media volume – turn it up before bed.
- Later: `npx cap init` + `npx cap add android` with `webDir: "."` turns
  this into a real Android app with true background alarms.
