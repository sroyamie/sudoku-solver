import { useState } from 'react';
import './App.css';

const API_URL = '';
const EMPTY_BOARD = Array(9).fill().map(() => Array(9).fill(0));

const PRESET_PUZZLES = {
  easy: [
    [5,3,0,0,7,0,0,0,0],
    [6,0,0,1,9,5,0,0,0],
    [0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],
    [4,0,0,8,0,3,0,0,1],
    [7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],
    [0,0,0,4,1,9,0,0,5],
    [0,0,0,0,8,0,0,7,9],
  ],
  hard: [
    [0,0,0,6,0,0,4,0,0],
    [7,0,0,0,0,3,6,0,0],
    [0,0,0,0,9,1,0,8,0],
    [0,0,0,0,0,0,0,0,0],
    [0,5,0,1,8,0,0,0,3],
    [0,0,0,3,0,6,0,4,5],
    [0,4,0,2,0,0,0,6,0],
    [9,0,3,0,0,0,0,0,0],
    [0,2,0,0,0,0,1,0,0],
  ],
};

function App() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCellChange = (row, col, value) => {
    if (value !== '' && !/^[1-9]$/.test(value)) return;

    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = value === '' ? 0 : parseInt(value);
    setBoard(newBoard);
    setError('');
  };

  const solvePuzzle = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board }),
      });
      const data = await res.json();

      if (data.solved) {
        setBoard(data.board);
      } else {
        setError(data.error || 'No solution exists for this puzzle');
      }
    } catch (err) {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  const clearBoard = () => {
    setBoard(EMPTY_BOARD);
    setError('');
  };

  const loadPreset = (difficulty) => {
    setBoard(PRESET_PUZZLES[difficulty].map((row) => [...row]));
    setError('');
  };

  return (
    <div className="app">
      <h1>🧩 Sudoku Solver</h1>

      <div className="presets">
        <button className="preset-btn" onClick={() => loadPreset('easy')}>
          Load Easy Puzzle
        </button>
        <button className="preset-btn" onClick={() => loadPreset('hard')}>
          Load Hard Puzzle
        </button>
      </div>

      <div className="grid">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <input
              key={`${rowIndex}-${colIndex}`}
              type="text"
              maxLength={1}
              autoComplete="off"
              value={cell === 0 ? '' : cell}
              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
              className={`cell 
                ${colIndex % 3 === 2 && colIndex !== 8 ? 'border-right' : ''} 
                ${rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-bottom' : ''}`}
            />
          ))
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="buttons">
        <button onClick={solvePuzzle} disabled={loading}>
          {loading ? 'Solving...' : 'Solve'}
        </button>
        <button onClick={clearBoard} className="clear-btn">
          Clear
        </button>
      </div>
    </div>
  );
}

export default App;