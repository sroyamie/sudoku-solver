import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import './App.css';

const API_URL = '';
const EMPTY_BOARD = Array(9).fill().map(() => Array(9).fill(0));
const emptyNotes = () => Array(9).fill().map(() => Array(9).fill().map(() => []));

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
  medium: [
    [0,2,0,6,0,8,0,0,0],
    [5,8,0,0,0,9,7,0,0],
    [0,0,0,0,4,0,0,0,0],
    [3,7,0,0,0,0,5,0,0],
    [6,0,0,0,0,0,0,0,4],
    [0,0,8,0,0,0,0,1,3],
    [0,0,0,0,2,0,0,0,0],
    [0,0,9,8,0,0,0,3,6],
    [0,0,0,3,0,6,0,9,0],
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

// Returns a 9x9 boolean grid: true if that cell conflicts with Sudoku rules
const getConflicts = (board) => {
  const conflicts = Array(9).fill().map(() => Array(9).fill(false));

  const markIfDuplicate = (cells) => {
    const seen = {};
    cells.forEach(([r, c]) => {
      const val = board[r][c];
      if (val === 0) return;
      if (!seen[val]) seen[val] = [];
      seen[val].push([r, c]);
    });
    Object.values(seen).forEach((positions) => {
      if (positions.length > 1) {
        positions.forEach(([r, c]) => { conflicts[r][c] = true; });
      }
    });
  };

  for (let r = 0; r < 9; r++) markIfDuplicate([...Array(9)].map((_, c) => [r, c]));
  for (let c = 0; c < 9; c++) markIfDuplicate([...Array(9)].map((_, r) => [r, c]));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push([br * 3 + i, bc * 3 + j]);
      markIfDuplicate(cells);
    }
  }

  return conflicts;
};

function App() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [notes, setNotes] = useState(emptyNotes());
  const [selectedCell, setSelectedCell] = useState(null);
  const [notesMode, setNotesMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [showStats, setShowStats] = useState(false);

  const historyRef = useRef([{ board: EMPTY_BOARD.map(r => [...r]), notes: emptyNotes() }]);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const conflicts = getConflicts(board);

  const commitChange = (newBoard, newNotes) => {
    const snapshot = {
      board: newBoard.map((r) => [...r]),
      notes: newNotes.map((r) => r.map((c) => [...c])),
    };
    const truncated = historyRef.current.slice(0, historyIndex + 1);
    historyRef.current = [...truncated, snapshot];
    setHistoryIndex(historyRef.current.length - 1);
    setBoard(newBoard);
    setNotes(newNotes);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const snap = historyRef.current[newIndex];
    setBoard(snap.board.map((r) => [...r]));
    setNotes(snap.notes.map((r) => r.map((c) => [...c])));
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= historyRef.current.length - 1) return;
    const newIndex = historyIndex + 1;
    const snap = historyRef.current[newIndex];
    setBoard(snap.board.map((r) => [...r]));
    setNotes(snap.notes.map((r) => r.map((c) => [...c])));
    setHistoryIndex(newIndex);
  };

  const enterDigit = (digit) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    if (!timerRunning) setTimerRunning(true);

    if (notesMode) {
      if (board[row][col] !== 0) return;
      const newNotes = notes.map((r) => r.map((c) => [...c]));
      const cellNotes = newNotes[row][col];
      const idx = cellNotes.indexOf(digit);
      if (idx >= 0) cellNotes.splice(idx, 1);
      else cellNotes.push(digit);
      commitChange(board, newNotes);
    } else {
      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = digit;

      // Check if this placement creates a new conflict
      const newConflicts = getConflicts(newBoard);
      if (newConflicts[row][col]) {
        setMistakeCount((prev) => prev + 1);
        playSound('error');
      }

      const newNotes = notes.map((r) => r.map((c) => [...c]));
      newNotes[row][col] = [];
      commitChange(newBoard, newNotes);
    }
    setError('');
  };

  const clearCell = () => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const newBoard = board.map((r) => [...r]);
    const newNotes = notes.map((r) => r.map((c) => [...c]));
    if (newBoard[row][col] !== 0) {
      newBoard[row][col] = 0;
    } else {
      newNotes[row][col] = [];
    }
    commitChange(newBoard, newNotes);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCell) return;
      const { row, col } = selectedCell;

      if (e.key >= '1' && e.key <= '9') {
        enterDigit(parseInt(e.key));
        e.preventDefault();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        clearCell();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedCell({ row: Math.max(0, row - 1), col });
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedCell({ row: Math.min(8, row + 1), col });
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        setSelectedCell({ row, col: Math.max(0, col - 1) });
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setSelectedCell({ row, col: Math.min(8, col + 1) });
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, notesMode, board, notes, historyIndex]);

  const getHint = async () => {
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
        // Find empty cells and reveal one at random
        const emptyCells = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) emptyCells.push([r, c]);
          }
        }
        if (emptyCells.length === 0) {
          setError('Board is already full');
        } else {
          const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          const newBoard = board.map((row) => [...row]);
          newBoard[r][c] = data.board[r][c];
          const newNotes = notes.map((row) => row.map((cell) => [...cell]));
          newNotes[r][c] = [];
          commitChange(newBoard, newNotes);
          setHintCount((prev) => prev + 1);
        }
      } else {
        setError('Fix conflicting cells before requesting a hint');
      }
    } catch (err) {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
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
        commitChange(data.board, emptyNotes());
        setTimerRunning(false);
        setShowStats(true);
        playSound('success');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
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
    const empty = EMPTY_BOARD.map((r) => [...r]);
    const notesEmpty = emptyNotes();
    historyRef.current = [{ board: empty.map((r) => [...r]), notes: emptyNotes() }];
    setHistoryIndex(0);
    setBoard(empty);
    setNotes(notesEmpty);
    setError('');
    setSeconds(0);
    setTimerRunning(false);
    setSelectedCell(null);
    setMistakeCount(0);
    setHintCount(0);
    setShowStats(false);
  };

  const loadPreset = (difficulty) => {
    const preset = PRESET_PUZZLES[difficulty].map((row) => [...row]);
    const notesEmpty = emptyNotes();
    historyRef.current = [{ board: preset.map((r) => [...r]), notes: emptyNotes() }];
    setHistoryIndex(0);
    setBoard(preset);
    setNotes(notesEmpty);
    setError('');
    setSeconds(0);
    setTimerRunning(true);
    setSelectedCell(null);
    setMistakeCount(0);
    setHintCount(0);
    setShowStats(false);
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="top-bar">
        <h1>🧩 Sudoku Solver</h1>
        <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div className="stats-bar">
        <span>⏱ {formatTime(seconds)}</span>
        <span>❌ Mistakes: {mistakeCount}</span>
        <span>💡 Hints: {hintCount}</span>
      </div>

      <div className="presets">
        <button className="preset-btn" onClick={() => loadPreset('easy')}>Easy</button>
        <button className="preset-btn" onClick={() => loadPreset('medium')}>Medium</button>
        <button className="preset-btn" onClick={() => loadPreset('hard')}>Hard</button>
      </div>

      {showStats && (
        <div className="stats-summary">
          🎉 Solved in {formatTime(seconds)} with {mistakeCount} mistake{mistakeCount !== 1 ? 's' : ''} and {hintCount} hint{hintCount !== 1 ? 's' : ''} used!
        </div>
      )}

      <div className="grid">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isSelected = selectedCell && selectedCell.row === rowIndex && selectedCell.col === colIndex;
            const cellNotes = notes[rowIndex][colIndex];
            const hasConflict = conflicts[rowIndex][colIndex];
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                className={`cell 
                  ${colIndex % 3 === 2 && colIndex !== 8 ? 'border-right' : ''} 
                  ${rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-bottom' : ''}
                  ${isSelected ? 'selected' : ''}
                  ${hasConflict ? 'conflict' : ''}`}
              >
                {cell !== 0 ? (
                  <span className="cell-value">{cell}</span>
                ) : cellNotes.length > 0 ? (
                  <div className="notes-grid">
                    {[1,2,3,4,5,6,7,8,9].map((n) => (
                      <span key={n} className="note-num">{cellNotes.includes(n) ? n : ''}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="controls-row">
        <button className="control-btn" onClick={undo} disabled={historyIndex <= 0}>↶ Undo</button>
        <button className="control-btn" onClick={redo} disabled={historyIndex >= historyRef.current.length - 1}>↷ Redo</button>
        <button className={`control-btn ${notesMode ? 'active' : ''}`} onClick={() => setNotesMode(!notesMode)}>
          ✏️ Notes {notesMode ? 'On' : 'Off'}
        </button>
        <button className="control-btn hint-btn" onClick={getHint} disabled={loading}>💡 Hint</button>
      </div>

      <div className="number-pad">
        {[1,2,3,4,5,6,7,8,9].map((n) => (
          <button key={n} onClick={() => enterDigit(n)}>{n}</button>
        ))}
        <button className="erase-btn" onClick={clearCell}>⌫</button>
      </div>

      <div className="buttons">
        <button onClick={solvePuzzle} disabled={loading}>{loading ? 'Solving...' : 'Solve'}</button>
        <button onClick={clearBoard} className="clear-btn">Clear</button>
      </div>
    </div>
  );
}

export default App;