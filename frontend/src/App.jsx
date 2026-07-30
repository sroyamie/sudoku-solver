import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
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

// Simple beep sounds using Web Audio API (no external sound files needed)
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'success') {
      oscillator.frequency.value = 880;
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      oscillator.start();
      oscillator.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      oscillator.frequency.value = 200;
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      oscillator.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    console.error('Sound playback failed:', e);
  }
};

function App() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCellChange = (row, col, value) => {
    if (value !== '' && !/^[1-9]$/.test(value)) return;

    if (!timerRunning && value !== '') {
      setTimerRunning(true);
    }

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
        setTimerRunning(false);
        playSound('success');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        setError(data.error || 'No solution exists for this puzzle');
        playSound('error');
      }
    } catch (err) {
      setError('Could not connect to the server');
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  const clearBoard = () => {
    setBoard(EMPTY_BOARD);
    setError('');
    setSeconds(0);
    setTimerRunning(false);
  };

  const loadPreset = (difficulty) => {
    setBoard(PRESET_PUZZLES[difficulty].map((row) => [...row]));
    setError('');
    setSeconds(0);
    setTimerRunning(true);
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="top-bar">
        <h1>🧩 Sudoku Solver</h1>
        <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div className="timer-display">⏱ {formatTime(seconds)}</div>

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