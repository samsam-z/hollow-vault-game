# samsam-z/hollow-vault-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/samsam-z/hollow-vault-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/samsam-z/hollow-vault-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Hollow Vault** is an original orbit-defense arcade game built entirely from static files: no
framework, no image or audio assets, no network. You command a turret orbiting a central vault with
three shields, firing outward at geometric intruders that close in from every side. Four enemy
archetypes need different answers — runners rush straight, splitters break into three, shield-bearers
deflect shots from the arc they face, and drifters weave — with a boss every fifth wave. Consecutive
kills build a combo multiplier and charge a meter you can spend on a screen-clearing nova. Hold the
fire button to charge a piercing heavy shot; a fleeting window to dodge by shifting your orbit keeps
the close calls alive. Sound is synthesised with Web Audio, and the neon art is drawn on canvas.

## Play it

```sh
node serve.ts          # http://localhost:8080
```

Or open `game/index.html` in a desktop browser. Keyboard: A/D or arrow keys orbit, mouse aims,
hold Space or click to charge, E or right-click for the nova, P/Esc pauses, M mutes, Enter starts
and restarts.

## Enter the bounty

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes the judge dossier with the
kit's vendored library. The three screenshots (title, play, results) are real browser renders of
the game's own code, taken through deterministic `?shot=` staging.

- `game/` — the static game: `index.html` plus ES modules, each with one clear job
- `screenshots/` — the cover, a live play frame, and the results screen
- `main.ts` — the Node 22 entrypoint that assembles `/output`
- `LICENSE` — MIT
- `.makefun/owner.json` — wallet claim

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
