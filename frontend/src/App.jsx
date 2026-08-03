import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import Auth from './Auth';
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

const getDuplicateConflicts = (board) => {
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
      if (positions.length > 1) positions.forEach(([r, c]) => { conflicts[r][c] = true; });
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

const encodeBoard = (board) => board.flat().join('');
const decodeBoard = (str) => {
  if (!/^\d{81}$/.test(str)) return null;
  const board = [];
  for (let i = 0; i < 9; i++) {
    board.push(str.slice(i * 9, i * 9 + 9).split('').map(Number));
  }
  return board;
};

// Step-by-step solver using a most-constrained-cell-first heuristic
// (dramatically fewer steps than naive backtracking, especially on hard puzzles)
const getCandidates = (board, row, col) => {
  const used = new Set();
  for (let x = 0; x < 9; x++) {
    used.add(board[row][x]);
    used.add(board[x][col]);
  }
  const startRow = row - row % 3;
  const startCol = col - col % 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      used.add(board[startRow + i][startCol + j]);
    }
  }
  const candidates = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) candidates.push(n);
  }
  return candidates;
};

const findBestEmptyCell = (board) => {
  let best = null;
  let bestCandidates = null;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const candidates = getCandidates(board, row, col);
        if (!best || candidates.length < bestCandidates.length) {
          best = [row, col];
          bestCandidates = candidates;
          if (candidates.length === 1) return { cell: best, candidates: bestCandidates };
        }
      }
    }
  }
  return { cell: best, candidates: bestCandidates };
};

const generateSteps = (initialBoard) => {
  const board = initialBoard.map((r) => [...r]);
  const steps = [];
  const MAX_STEPS = 30000;
  let aborted = false;

  const solve = () => {
    if (steps.length > MAX_STEPS) { aborted = true; return true; }
    const { cell, candidates } = findBestEmptyCell(board);
    if (!cell) return true;
    const [row, col] = cell;
    for (const num of candidates) {
      board[row][col] = num;
      steps.push({ row, col, value: num, type: 'place' });
      if (solve()) return true;
      board[row][col] = 0;
      steps.push({ row, col, value: 0, type: 'remove' });
      if (steps.length > MAX_STEPS) { aborted = true; return true; }
    }
    return false;
  };

  const solved = solve();
  return { steps, solved: solved && !aborted, aborted };
};

function App() {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [notes, setNotes] = useState(emptyNotes());
  const [selectedCell, setSelectedCell] = useState(null);
  const [notesMode, setNotesMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [genDifficulty, setGenDifficulty] = useState('medium');
  const [user, setUser] = useState(null);
  const [savedGames, setSavedGames] = useState([]);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [statsData, setStatsData] = useState(null);

  // Visualization state
  const [visualizing, setVisualizing] = useState(false);
  const [vizPlaying, setVizPlaying] = useState(false);
  const [vizIndex, setVizIndex] = useState(0);
  const [vizSpeed, setVizSpeed] = useState(30);
  const [vizBoard, setVizBoard] = useState(null);
  const [vizLastStep, setVizLastStep] = useState(null);
  const vizStepsRef = useRef([]);

  const historyRef = useRef([{ board: EMPTY_BOARD.map(r => [...r]), notes: emptyNotes() }]);
  const solutionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('puzzle');
    if (shared) {
      const decoded = decodeBoard(shared);
      if (decoded) {
        loadCustomBoard(decoded);
        setMessage('Loaded shared puzzle!');
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Visualization playback loop
  useEffect(() => {
    if (!visualizing || !vizPlaying) return;
    if (vizIndex >= vizStepsRef.current.length) {
      setVizPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const step = vizStepsRef.current[vizIndex];
      setVizBoard((prev) => {
        const next = prev.map((r) => [...r]);
        next[step.row][step.col] = step.value;
        return next;
      });
      setVizLastStep(step);
      setVizIndex((prev) => prev + 1);
    }, vizSpeed);
    return () => clearTimeout(timer);
  }, [visualizing, vizPlaying, vizIndex, vizSpeed]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConflicts = (currentBoard) => {
    if (solutionRef.current) {
      const conflicts = Array(9).fill().map(() => Array(9).fill(false));
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (currentBoard[r][c] !== 0 && currentBoard[r][c] !== solutionRef.current[r][c]) {
            conflicts[r][c] = true;
          }
        }
      }
      return conflicts;
    }
    return getDuplicateConflicts(currentBoard);
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

      const wrong = solutionRef.current
        ? digit !== solutionRef.current[row][col]
        : getDuplicateConflicts(newBoard)[row][col];

      if (wrong) {
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
      if (visualizing) return;
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
  }, [selectedCell, notesMode, board, notes, historyIndex, visualizing]);

  const computeSolution = async (originalBoard) => {
    try {
      const res = await fetch(`${API_URL}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: originalBoard }),
      });
      const data = await res.json();
      if (data.solved) {
        solutionRef.current = data.board;
      }
    } catch (err) {
      console.error('Failed to precompute solution:', err);
    }
  };

  const getHint = () => {
    if (!solutionRef.current) {
      setError('Still preparing this puzzle, try again in a moment');
      return;
    }
    const emptyCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) emptyCells.push([r, c]);
      }
    }
    if (emptyCells.length === 0) {
      setError('Board is already full');
      return;
    }
    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = board.map((row) => [...row]);
    newBoard[r][c] = solutionRef.current[r][c];
    const newNotes = notes.map((row) => row.map((cell) => [...cell]));
    newNotes[r][c] = [];
    commitChange(newBoard, newNotes);
    setHintCount((prev) => prev + 1);
    setError('');
  };

  const saveCompletedGame = async () => {
    try {
      await supabase.from('sudoku_games').insert({
        user_id: user.id,
        board: encodeBoard(solutionRef.current),
        difficulty: genDifficulty,
        seconds_elapsed: seconds,
        mistakes: mistakeCount,
        hints_used: hintCount,
        completed: true,
      });
    } catch (err) {
      console.error('Failed to save completed game:', err);
    }
  };

  const solvePuzzle = async () => {
    setError('');

    if (solutionRef.current) {
      commitChange(solutionRef.current.map(r => [...r]), emptyNotes());
      setTimerRunning(false);
      setShowStats(true);
      playSound('success');
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      if (user) saveCompletedGame();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board }),
      });
      const data = await res.json();

      if (data.solved) {
        solutionRef.current = data.board;
        commitChange(data.board, emptyNotes());
        setTimerRunning(false);
        setShowStats(true);
        playSound('success');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        if (user) saveCompletedGame();
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
    setMessage('');
    setSeconds(0);
    setTimerRunning(false);
    setSelectedCell(null);
    setMistakeCount(0);
    setHintCount(0);
    setShowStats(false);
    solutionRef.current = null;
    stopVisualization();
  };

  const loadCustomBoard = (newBoard) => {
    const notesEmpty = emptyNotes();
    historyRef.current = [{ board: newBoard.map((r) => [...r]), notes: emptyNotes() }];
    setHistoryIndex(0);
    setBoard(newBoard);
    setNotes(notesEmpty);
    setError('');
    setSeconds(0);
    setTimerRunning(true);
    setSelectedCell(null);
    setMistakeCount(0);
    setHintCount(0);
    setShowStats(false);
    solutionRef.current = null;
    computeSolution(newBoard);
  };

  const loadPreset = (difficulty) => {
    loadCustomBoard(PRESET_PUZZLES[difficulty].map((row) => [...row]));
    setMessage('');
    stopVisualization();
  };

  const generatePuzzle = async () => {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: genDifficulty }),
      });
      const data = await res.json();
      loadCustomBoard(data.board);
    } catch (err) {
      setError('Could not generate a new puzzle');
    } finally {
      setGenerating(false);
    }
    stopVisualization();
  };

  const sharePuzzle = async () => {
    const encoded = encodeBoard(board);
    const url = `${window.location.origin}${window.location.pathname}?puzzle=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Share link copied to clipboard!');
    } catch (err) {
      setMessage(url);
    }
  };

  const downloadPuzzle = () => {
    const encoded = encodeBoard(board);
    const blob = new Blob([encoded], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sudoku-puzzle.txt';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Puzzle downloaded!');
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result.trim();
      const decoded = decodeBoard(text);
      if (decoded) {
        loadCustomBoard(decoded);
        setMessage('Puzzle imported successfully!');
      } else {
        setError('Invalid puzzle file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveProgress = async () => {
    if (!user) {
      setMessage('Please log in to save progress');
      return;
    }
    try {
      await supabase.from('sudoku_games').insert({
        user_id: user.id,
        board: encodeBoard(board),
        difficulty: genDifficulty,
        seconds_elapsed: seconds,
        mistakes: mistakeCount,
        hints_used: hintCount,
        completed: false,
      });
      setMessage('Progress saved!');
    } catch (err) {
      setMessage('Failed to save progress');
    }
  };

  const loadSavedGames = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('sudoku_games')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedGames(data);
    } catch (err) {
      console.error('Failed to load saved games:', err);
    }
  };

  const resumeGame = (game) => {
    const decoded = decodeBoard(game.board);
    if (decoded) {
      loadCustomBoard(decoded);
      setSeconds(game.seconds_elapsed);
      setMistakeCount(game.mistakes);
      setHintCount(game.hints_used);
      setMessage('Resumed saved game');
      setShowStatsPanel(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('sudoku_games')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true);
      if (error) throw error;

      const totalSolved = data.length;
      const totalTime = data.reduce((sum, g) => sum + g.seconds_elapsed, 0);
      const totalMistakes = data.reduce((sum, g) => sum + g.mistakes, 0);
      const totalHints = data.reduce((sum, g) => sum + g.hints_used, 0);
      const byDifficulty = { easy: 0, medium: 0, hard: 0 };
      data.forEach((g) => { if (byDifficulty[g.difficulty] !== undefined) byDifficulty[g.difficulty]++; });

      setStatsData({ totalSolved, totalTime, totalMistakes, totalHints, byDifficulty });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const openStatsPanel = () => {
    setShowStatsPanel(true);
    loadSavedGames();
    loadStats();
  };

  // Visualization controls
  const startVisualization = () => {
    const original = historyRef.current[0].board;
    const { steps, solved, aborted } = generateSteps(original);
    if (aborted) {
      setError('This puzzle is too complex to visualize step-by-step');
      return;
    }
    if (!solved) {
      setError('No solution exists for this puzzle');
      return;
    }
    vizStepsRef.current = steps;
    setVizIndex(0);
    setVizBoard(original.map((r) => [...r]));
    setVizLastStep(null);
    setVisualizing(true);
    setVizPlaying(true);
    setError('');
  };

  const toggleVizPlay = () => setVizPlaying((prev) => !prev);

  const skipToEnd = () => {
    const original = historyRef.current[0].board;
    const finalBoard = original.map((r) => [...r]);
    vizStepsRef.current.forEach((step) => {
      finalBoard[step.row][step.col] = step.value;
    });
    // Reapply only 'place' values properly by replaying all steps in order (last write wins per cell is fine since final state is deterministic)
    setVizBoard(solutionRef.current ? solutionRef.current.map(r => [...r]) : finalBoard);
    setVizIndex(vizStepsRef.current.length);
    setVizPlaying(false);
  };

  const stopVisualization = () => {
    setVisualizing(false);
    setVizPlaying(false);
    setVizBoard(null);
    setVizLastStep(null);
    setVizIndex(0);
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Auth user={user} />
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

      {!visualizing && (
        <>
          <div className="presets">
            <button className="preset-btn" onClick={() => loadPreset('easy')}>Easy</button>
            <button className="preset-btn" onClick={() => loadPreset('medium')}>Medium</button>
            <button className="preset-btn" onClick={() => loadPreset('hard')}>Hard</button>
          </div>

          <div className="generator-row">
            <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button className="generate-btn" onClick={generatePuzzle} disabled={generating}>
              🎲 {generating ? 'Generating...' : 'Generate New Puzzle'}
            </button>
          </div>

          <div className="io-row">
            <button className="io-btn" onClick={sharePuzzle}>🔗 Share</button>
            <button className="io-btn" onClick={downloadPuzzle}>⬇️ Download</button>
            <label className="io-btn">
              ⬆️ Import
              <input type="file" accept=".txt" onChange={handleImportFile} hidden ref={fileInputRef} />
            </label>
            <button className="io-btn viz-btn" onClick={startVisualization}>🎬 Visualize Solve</button>
          </div>

          {user && (
            <div className="io-row">
              <button className="io-btn" onClick={saveProgress}>💾 Save Progress</button>
              <button className="io-btn" onClick={openStatsPanel}>📊 My Stats</button>
            </div>
          )}
        </>
      )}

      {visualizing && (
        <div className="viz-controls">
          <button className="control-btn" onClick={toggleVizPlay}>{vizPlaying ? '⏸ Pause' : '▶️ Play'}</button>
          <button className="control-btn" onClick={skipToEnd}>⏭ Skip to End</button>
          <button className="control-btn" onClick={stopVisualization}>✕ Stop</button>
          <select value={vizSpeed} onChange={(e) => setVizSpeed(Number(e.target.value))}>
            <option value={100}>Slow</option>
            <option value={30}>Normal</option>
            <option value={5}>Fast</option>
          </select>
          <span className="viz-progress">{vizIndex} / {vizStepsRef.current.length} steps</span>
        </div>
      )}

      {showStatsPanel && (
        <div className="stats-panel">
          <button className="close-panel" onClick={() => setShowStatsPanel(false)}>✕</button>
          <h3>📊 Your Statistics</h3>
          {statsData && (
            <div className="stats-grid">
              <div>✅ Solved: {statsData.totalSolved}</div>
              <div>⏱ Total time: {formatTime(statsData.totalTime)}</div>
              <div>❌ Total mistakes: {statsData.totalMistakes}</div>
              <div>💡 Total hints: {statsData.totalHints}</div>
              <div>Easy: {statsData.byDifficulty.easy}</div>
              <div>Medium: {statsData.byDifficulty.medium}</div>
              <div>Hard: {statsData.byDifficulty.hard}</div>
            </div>
          )}

          <h3>💾 Saved Games</h3>
          {savedGames.filter(g => !g.completed).length === 0 && <p className="no-data">No saved games in progress</p>}
          {savedGames.filter(g => !g.completed).map((game) => (
            <div key={game.id} className="saved-game-item">
              <span>{game.difficulty} — {formatTime(game.seconds_elapsed)}</span>
              <button className="resume-btn" onClick={() => resumeGame(game)}>Resume</button>
            </div>
          ))}
        </div>
      )}

      {message && <p className="message">{message}</p>}

      {showStats && (
        <div className="stats-summary">
          🎉 Solved in {formatTime(seconds)} with {mistakeCount} mistake{mistakeCount !== 1 ? 's' : ''} and {hintCount} hint{hintCount !== 1 ? 's' : ''} used!
        </div>
      )}

      <div className="grid">
        {visualizing
          ? vizBoard.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isActive = vizLastStep && vizLastStep.row === rowIndex && vizLastStep.col === colIndex;
                return (
                  <div
                    key={`viz-${rowIndex}-${colIndex}`}
                    className={`cell 
                      ${colIndex % 3 === 2 && colIndex !== 8 ? 'border-right' : ''} 
                      ${rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-bottom' : ''}
                      ${isActive ? (vizLastStep.type === 'place' ? 'viz-place' : 'viz-remove') : ''}`}
                  >
                    {cell !== 0 ? <span className="cell-value">{cell}</span> : null}
                  </div>
                );
              })
            )
          : board.map((row, rowIndex) =>
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

      {!visualizing && (
        <>
          <div className="controls-row">
            <button className="control-btn" onClick={undo} disabled={historyIndex <= 0}>↶ Undo</button>
            <button className="control-btn" onClick={redo} disabled={historyIndex >= historyRef.current.length - 1}>↷ Redo</button>
            <button className={`control-btn ${notesMode ? 'active' : ''}`} onClick={() => setNotesMode(!notesMode)}>
              ✏️ Notes {notesMode ? 'On' : 'Off'}
            </button>
            <button className="control-btn hint-btn" onClick={getHint}>💡 Hint</button>
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
        </>
      )}
    </div>
  );
}

export default App;