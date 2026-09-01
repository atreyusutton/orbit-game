# orbit

A PICO-8 game. Slingshot between planets to rescue stranded crew.

Gravity-driven arcade game — you never thrust directly. You tether to
planets, swing around them, and release at the right moment to reach the
next one. Eight levels, with black holes, hostiles, and a limited shield.

## Play

Requires [PICO-8](https://www.lexaloffle.com/pico-8.php).

```sh
pico8 -run orbit.p8
```

Or from inside PICO-8:

```
load orbit.p8
run
```

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

Copy it back here after a session in PICO-8.
