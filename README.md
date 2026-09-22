# Happy Birthday — an Interactive Birthday Website 🌷🎂

A fully static, single-page birthday adventure for Qurat Ul Ain that runs entirely in the browser.

No backend. No database. No accounts. No tracking. Everything happens locally.

## What it does

A magical 14-scene journey:

1. 🌌 **Magical opening** — a starry greeting that eases into the experience.
2. 📜 **Secret intro** — a warm, animated welcome message.
3. ⏳ **Birthday countdown** — live days/hours/minutes/seconds to **25 September 2026**. On the day itself, it automatically switches to a birthday mode and skips straight into the experience.
4. 🚪 **The birthday door** — a special door that opens into the celebration.
5. 🎂 **Cake studio** — pick from 6 bases, 6 frostings and 5 messages. The cake is drawn live with pure HTML/CSS and previewed instantly.
6. 🍰 **Decoration time** — add up to 8 of 10 toppings and 6 decorations, plus 1/3/5/7/9 candles. A "surprise me" shuffle and a reset are included.
7. 🕯️ **Candle ceremony** — light every candle one by one until the room glows.
8. ✨ **Make a wish** — squeeze and hold the glowing button to seal the wish (with a progress ring + sparkles).
9. 🎁 **Mystery gifts** — pick one of five gift boxes.
10. 🍬 **Gift reveal** — unwrap the surprise birthday message.
11. 🎉 **Big celebration** — confetti, fireworks and a fully-lit cake.
12. 💌 **Birthday memory card** — a personalised card that summarises the choices made that run (cake, frosting, toppings, candle count).
13. 🌠 **One last surprise** — a hidden final message.
14. 🌟 **Final screen** — a grand farewell with an interactive cake (tap the candles) and a start-over button that resets everything for the next visitor.

If someone opens the website after 25 September 2026, the countdown is skipped automatically and they go straight into the birthday experience.

## Running locally

You don't need anything installed except a simple static server:

```sh
python -m http.server 8080
```

Then open <http://localhost:8080> in a browser.

You can also just open `index.html` directly by double-clicking it. (The optional music still works best from a local server because of how browsers treat file access.)

## Adding music (optional)

Place an audio file at:

```
assets/music.mp3
```

The website automatically:

- starts music only after the visitor interacts (browser autoplay rules are respected),
- plays at a gentle volume (~0.25) with a smooth 2-second fade-in,
- loops continuously,
- provides a 🎵 toggle button (🔊 / 🔇).

If `assets/music.mp3` is missing, the music button hides itself and the website works exactly as before.

## Publishing on GitHub Pages

1. Create a repository on GitHub (any public or private repo works with Pages).
2. Push this folder to the repository.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch** and select `main` (or `master`) with the root `/` folder.
5. Save. Your site is published at `https://<username>.github.io/<repository>/`.

All asset paths are relative, so no configuration is needed.

## Project structure

```
.
├── index.html      # all scenes and markup
├── style.css       # themes, animations, cake design, responsive layout
├── script.js       # countdown, cake builder, wish, gift, music, particles
├── README.md
└── assets/
    ├── README.md   # notes about the optional music file
    └── music.mp3   # optional — add your own file
```

## Accessibility & performance

- Semantic HTML, keyboard-focusable buttons, aria labels and `prefers-reduced-motion` support (animations switch off for reduced motion).
- Mobile-first layout tested down to 390px wide; option rows, gift boxes and the cake all fit without page-level horizontal scrolling.
- Particle effects are capped and cleaned up automatically so everything stays smooth on ordinary phones.
- No external scripts, fonts, APIs or cookies.