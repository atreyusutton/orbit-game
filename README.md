# orbit

A PICO-8 game. Slingshot between planets to rescue stranded crew.

Gravity-driven arcade game — you never thrust directly. You tether to
planets, swing around them, and release at the right moment to reach the
next one. Eight levels, with black holes, hostiles, and a limited shield.

## Play in a browser

Open `dist/orbit.html`. No PICO-8 needed, no server, no install:

```sh
open dist/orbit.html
```

It is one self-contained file with the cart embedded. It fetches the Lua
VM from a CDN on load, so first open needs a connection.

## Play in PICO-8

```sh
pico8 -run orbit.p8
```

Or from inside PICO-8: `load orbit.p8` then `run`.

## Controls

Two buttons in play. There is no thrust and no steering — all your
control is *when* you grab and *when* you let go.

| Key | Action |
| --- | --- |
| `Z` | Tether to the nearest planet / release |
| `X` | Shield bubble (18 frames, 45-frame cooldown) |
| Arrows | Menu and level select only |

Tethering grabs the nearest planet within 45 units. Swing direction is
set automatically from the cross product of your position and velocity,
so you keep the way you were already going — approach angle is what
decides the arc.

## Development

The cart is the source — `orbit.p8` holds the Lua, sprites, map, sound
and music in one file. Edit it in PICO-8's built-in editor, or edit the
Lua directly in any text editor and reload.

Working copy lives at:

```
~/Library/Application Support/pico-8/carts/orbit.p8
```

Copy it back here after a session in PICO-8, then rebuild the web player:

```sh
node web/build.mjs
```

### The web player

`web/` is a small PICO-8-alike runtime written for this cart. It is not an
emulator: it runs the cart's real Lua through [fengari](https://fengari.io)
(a Lua 5.3 VM in JavaScript) against a hand-written implementation of the
PICO-8 API. The cart stays the single source of truth — edit `orbit.p8`,
rebuild, and the player picks the changes up.

| File | Role |
| --- | --- |
| `engine.js` | Palette, 3×5 font, `.p8` parser, Lua-dialect preprocessor, indexed framebuffer + rasterizer |
| `runtime.js` | Binds the cart's Lua to the PICO-8 API. No DOM — so it runs headlessly under node |
| `host.js` | Browser half: canvas, keyboard, touch, WebAudio, frame loop |
| `shell.html` | Page template with `{{...}}` placeholders |
| `build.mjs` | Inlines the above + the cart into `dist/`. Node builtins only, no install |

Two outputs, because they need different wrappers: `dist/orbit.html` is a
full document to open locally; `dist/orbit.artifact.html` is a body-only
fragment for publishing.

**What it implements.** The 24 API functions this cart calls: `cls` `pset`
`pget` `line` `rect` `rectfill` `circ` `circfill` `print` `camera` `clip`
`color` `pal`, the math set (with PICO-8's turn-based, inverted `sin` and
its `atan2`), `btn`/`btnp` with PICO-8's 15-frame/4-frame repeat, `sfx`
via WebAudio, and the table helpers, including a deletion-safe `all()`.
The dialect preprocessor handles `+=`-style compound assignment, `!=`,
one-line `if (c) stmt`, and `?` print shorthand.

**What it does not.** No sprites, map, or music — this cart draws entirely
with primitives and its `__gfx__` is empty, so `spr`/`map`/`music` are
no-ops. No `peek`/`poke` or memory model. Numbers are JS doubles, not
PICO-8's 16.16 fixed point, so a cart relying on fixed-point overflow
would diverge; this one does not. Waveforms are approximations of
PICO-8's eight.
