# ksudoku

A clean Sudoku for jailbroken Kindles (Mesquite web app, installed with KPM).

- Board, number pad, Notes and Erase on screen. Everything else is under **Settings**.
- Settings: difficulty, new game, restart, and what happens to a number key once all 9 are placed (keep / grey out / hide).
- Notes mode: small pencil marks in each cell. Placing a number clears it from notes in the same row, column and box.
- A short win animation, kept to a few frames for e-ink.
- Progress is saved automatically.

## Release a new version

```sh
./release.sh 1.2.4 "what changed"
```

It sets the version in `manifest.json`, `app/config.xml` and `app/index.html`, runs `node test.js`,
packs `ksudoku_<version>_kindleany.kpkg` into `../kile-kpm-repo` (or `$KPM_REPO`), adds it to that
repo's `manifest.json`, then commits and pushes. GitHub Actions publishes the repo index.

## Test the puzzle generator

```sh
node test.js
```

To try the UI on a computer, open `app/index.html` in a browser.
