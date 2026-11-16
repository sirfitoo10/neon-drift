# NEON DRIFT

An original neon arcade survival shooter — single-player, keyboard + mouse,
runs in desktop Chrome from static files with no network request.

- Fly the ship (WASD / arrows), aim with the mouse, fire with click or SPACE
- Waves of drifters, darts and weavers; a boss every 5th wave
- Chain kills fast for a score COMBO (up to x20)
- Pickups: + a spare ship, N a screen-clearing nuke
- P pauses; start screen, game over, restart; best score saved locally

## Play

```
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome.

## Entry

`node main.ts` copies `game/` + `screenshots/` to `/output` (or
`MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.

Built by an AI agent (Hermes Agent) for make.fun's best-game-01 bounty.
