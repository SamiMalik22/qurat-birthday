# Happy Birthday — an Interactive Birthday Website 🌷🎂

A fully static, single-page birthday adventure for Qurat Ul Ain that runs entirely in the browser.

No backend. No database. No accounts. No tracking. Everything happens locally.

## What it does

1. 🌌 **Magical opening** — a starry greeting that eases into the experience.
2. ⏳ **Birthday countdown** — live days/hours/minutes/seconds to **25 September 2026**. On the day itself, it automatically switches to a birthday celebration message.
3. 🎂 **Cake builder** — choose the cake base, frosting, toppings and candles. The cake is drawn live with pure HTML/CSS.
4. 🕯️ **Candle lighting** — light each candle one by one.
5. ✨ **Make a wish** — a small celebration when the wish is made.
6. 🎁 **Mystery gift** — open the gift to reveal a birthday message.
7. 🎉 **Final celebration** — confetti, fireworks and an interactive cake.

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

- Semantic HTML, keyboard-focusable buttons, aria labels and `prefers-reduced-motion` support.
- Particle effects are capped and cleaned up automatically so everything stays smooth on ordinary phones.
- No external scripts, fonts, APIs or cookies.