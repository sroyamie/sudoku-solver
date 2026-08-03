# 🧩 Sudoku Solver

A full-stack Sudoku web app that goes well beyond a basic solver — featuring real user accounts, saved progress, a statistics dashboard, puzzle generation, and a live step-by-step visualization of the solving algorithm.

## Features

**Core gameplay**
- Interactive 9x9 grid with keyboard navigation, click-to-select, and an on-screen number pad (mobile-friendly)
- Auto Notes (candidate pencil marks) with dedicated notes mode
- Undo/Redo with full history tracking
- Real-time mistake detection (compares entries against the puzzle's actual solution, not just basic rule conflicts)
- Hint system that reveals one correct cell at a time
- Three difficulty levels (Easy/Medium/Hard), both as curated presets and via a puzzle generator
- Timer, mistake counter, and hint counter, with a post-solve performance summary

**Puzzle I/O**
- Puzzle Generator — creates a new random valid puzzle at a chosen difficulty
- Share Puzzle — encodes the board into a URL others can open directly
- Download/Import Puzzle — save a puzzle to a file and reload it later

**Accounts & persistence**
- Full signup/login/logout via Supabase Auth
- Save in-progress games and resume them later
- Personal statistics dashboard (puzzles solved, total time, mistakes, hints, breakdown by difficulty)
- Row-Level Security ensures each user can only ever access their own saved data

**Step-by-Step Visualization**
- Watch the backtracking algorithm solve a puzzle live, cell by cell, with placements and backtracks color-coded
- Uses a most-constrained-cell-first (MRV) heuristic instead of naive backtracking — this cut the "Hard" preset from ~1.75 million backtracking steps down to about 13,000, making live visualization actually feasible
- Playback controls: play/pause, adjustable speed, skip-to-end

**Polish**
- Dark mode
- Sound effects and confetti animation on solve
- Fully responsive layout for mobile

## Tech Stack
- **Frontend:** React (Vite), canvas-confetti
- **Backend:** Flask (Python), deployed as a Vercel serverless function
- **Algorithm:** Backtracking with constraint validation; MRV heuristic for the visualization engine (implemented client-side in JS for smooth animation)
- **Auth & Database:** Supabase (Postgres + built-in authentication, Row-Level Security policies)
- **Deployment:** Single Vercel deployment serving both frontend and backend

## API Endpoints
- `POST /api/solve` — Solve a given 9x9 board
- `POST /api/generate` — Generate a new puzzle at a given difficulty

## How the Solver Works
The backend uses standard backtracking with row/column/3x3-box constraint checking to solve puzzles instantly. For the step-by-step visualization, a separate solver runs client-side in JavaScript using a most-constrained-cell heuristic (always filling in the cell with the fewest legal candidates first), which is what makes it practical to animate even genuinely hard puzzles without freezing the browser or generating an unmanageable number of steps.

Mistake detection, hints, and the "Solve" button all rely on a solution computed once when a puzzle loads (not re-solved from the user's live, possibly-incorrect board state) — this was an important fix during development, since re-solving a partially-wrong board will often correctly report "no solution exists" even when the puzzle itself is fine.

## Running Locally

Since the backend is a Vercel serverless function, local development uses the Vercel CLI rather than running Flask directly:

```bash
npm install -g vercel
vercel dev
```

This serves both the frontend and the `/api` functions together at `http://localhost:3000`.

## Future Improvements
- Verify puzzle generator output has a unique solution (currently prioritizes generation speed over uniqueness guarantees)
- Leaderboards / comparing stats with other users
- Multiplayer race mode