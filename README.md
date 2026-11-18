# Fizzo

A demo site for an invented fruit soda brand with nine flavours. The cans are real 3D,
drawn in the browser by our own code. No video and no 3D library.

Open it at http://localhost:5197 (start the `all-sites` server first).

## What is on the page

1. **Opening.** Fruit flies out, a counter runs to 100, the logo opens the page.
2. **Flavours.** A row of cans. Drag it, tap a can, or let it play. The whole page takes the colour of the can in the middle.
3. **Inside.** One can turns through four chapters as you scroll, then a storm of bubbles.
4. **Grab a can.** Nine cards. They tilt under the mouse, the can spins when poked, and + drops it into your box.
5. **Build your 3-pack.** Three cans in a glowing circle. × takes one out. The button counts down.
6. **Pick your fizz.** All nine cans hang on a rail. Drag it and they swing. Tap one to spin it.
7. **Q&A** and a sign-up form.

## Files

| File | What it does |
|---|---|
| `config.js` | Every word, price and flavour. Change things here. |
| `gl.js` | The 3D engine that draws the cans. |
| `art.js` | The can labels, the drawn fruit and the sounds. |
| `app.js` | How each part of the page behaves. |
| `styles.css` | The look. |
| `guide.html` | The prompts for the nine fruit pictures. |

## Fruit pictures

The site works without any pictures: it draws simple fruit itself.
Real fruit cut-outs go in `assets/bits` as `mango-1.webp`, `mango-2.webp` and so on,
and `assets/bits/manifest.json` says how many each flavour has, for example `{ "mango": 5 }`.

## Good to know

- Add a flavour by adding one entry to `flavours` in `config.js`. Its can, card and rail place appear by themselves.
- `?nointro` at the end of the address skips the opening.
- Nothing is sent anywhere. The basket and the sign-up form are for show.
