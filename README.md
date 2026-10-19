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

## Known limits of the PWA approach

- The phone's browser must stay open and in the foreground all night. Closing
  the tab means no alarm. This is the trade-off for needing no app store.
- Volume is capped by the phone's media volume – turn it up before bed.
- Later: `npx cap init` + `npx cap add android` with `webDir: "."` turns
  this into a real Android app with true background alarms.

## Bonus: Cash Out (game)

`game/` holds **Cash Out**, a money-themed wave-survival shooter in the style
of Black Ops Zombies. It's separate from the alarm app and shares no code
with it. Play it at `https://mauricestuder.github.io/wakeup/game/`, or locally
at <http://localhost:8080/game/> with the server above. It needs a keyboard
and mouse.

- Fight off rounds of **Debt Bots**, **Tax Collectors** (fast, from round 4)
  and **Loan Sharks** (tanky, every 5th round). Hits and kills earn cash.
- Guns shoot money: Penny Pistol (coins), Bill Blaster (banknotes), Gold Bar
  Shotgun, plus the Coin Minigun, Diamond Rifle and Piggy Launcher from the
  **Slot Machine** ($950).
- Spend cash on wall-buys, the doors to the Trading Floor and Vault, perk
  machines (Health Insurance, Fast Cash, Compound Interest) and the
  **Gold Plater** in the Vault, which upgrades a gun to 24K.
- **G** throws a Money Bag grenade. Killed bots sometimes drop Max Ammo,
  Double Cash, Insta-Kill or Market Crash.

Built with plain JS modules and [Three.js](https://threejs.org) r160
(vendored in `game/vendor/`, MIT). Graphics and sounds are generated in code,
so there are no asset files.
