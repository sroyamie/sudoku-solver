# 🧩 Sudoku Solver

A full-stack web application that solves 9x9 Sudoku puzzles instantly using a backtracking algorithm, with an interactive grid interface.

## Features
- Interactive 9x9 Sudoku grid with input validation (digits 1-9 only)
- Instant solving powered by a recursive backtracking algorithm
- Preset example puzzles (easy/hard) for quick demos
- Clear board functionality
- Error handling for invalid or unsolvable puzzles

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Flask (Python), deployed as a Vercel serverless function
- **Algorithm:** Backtracking with constraint satisfaction (row/column/3x3 box validation)
- **Deployment:** Single Vercel deployment serving both frontend and backend

## How It Works
The React frontend renders an editable 9x9 grid. On clicking "Solve," the current board state is sent to a Flask API endpoint running as a Vercel serverless function. The backend recursively attempts to fill empty cells with valid digits, checking row, column, and 3x3 box constraints at each step, backtracking whenever a dead end is reached until the puzzle is fully solved (or determined unsolvable).

## API Endpoint
- `POST /api/solve` — Accepts a 9x9 board (0s for empty cells) and returns the solved board, or an error if no solution exists.

## Running Locally

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend (serverless function, for local testing with Vercel CLI):**
```bash
npm i -g vercel
vercel dev
```

## Future Improvements
- Difficulty-based puzzle generation (not just fixed presets)
- Step-by-step solve visualization (animate the backtracking process)
- Puzzle validity checker before solving (detect contradictions upfront)