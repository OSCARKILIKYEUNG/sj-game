# sj-game

A hand-drawn canvas jumper, served as a single static `index.html` on GitHub Pages. Personal / internal use only — the page carries `noindex`; keep the URL unlisted and non-commercial.

- `index.html` is a **build artifact** (PROD channel). `dev/index.html` is the **DEV channel** (testing: DEV stamp, all story levels unlocked) — new builds land there first, PROD updates on promotion. The source of truth (ES-module `src/`, esbuild step, 151-check headless test suite) lives in a private repo; `node build.mjs` there emits both files.
- Deployment: the static workflow in `.github/workflows/deploy-pages.yml` republishes the site on every push to `main` (~1 min).
- History note: an experimental **Phaser v3 + TypeScript + Vite rebuild** of the same game was live 2026-07-10 → 2026-07-13. It remains fully preserved in git history (`490130b` … `82ea8e3`) — restore with `git checkout 82ea8e3 -- .` if ever wanted.

Debug URL params of the current build: `?start=1` · `?boss=1|2` · `?h=N` (start N points up) · `?gear=cap|sense|hulk` · `?tut=N` (tutorial topic) · `?gallery=1` + `?page=1` · `?freeze=N` · `?touch=1`.
