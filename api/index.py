from flask import Flask, request, jsonify
import random

app = Flask(__name__)

def is_valid(board, row, col, num):
    for x in range(9):
        if board[row][x] == num:
            return False
    for x in range(9):
        if board[x][col] == num:
            return False
    start_row = row - row % 3
    start_col = col - col % 3
    for i in range(3):
        for j in range(3):
            if board[i + start_row][j + start_col] == num:
                return False
    return True

def solve_sudoku(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                for num in range(1, 10):
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if solve_sudoku(board):
                            return True
                        board[row][col] = 0
                return False
    return True

def fill_board(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                nums = list(range(1, 10))
                random.shuffle(nums)
                for num in nums:
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if fill_board(board):
                            return True
                        board[row][col] = 0
                return False
    return True

def generate_puzzle(difficulty):
    board = [[0] * 9 for _ in range(9)]
    fill_board(board)
    puzzle = [row[:] for row in board]

    clues_target = {'easy': 40, 'medium': 32, 'hard': 26}.get(difficulty, 32)
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)

    total_filled = 81
    for (r, c) in cells:
        if total_filled <= clues_target:
            break
        puzzle[r][c] = 0
        total_filled -= 1

    return puzzle

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json() or {}
    difficulty = data.get("difficulty", "medium")
    puzzle = generate_puzzle(difficulty)
    return jsonify({"board": puzzle})

@app.route("/api/solve", methods=["POST"])
def solve():
    data = request.get_json()
    board = data.get("board")

    if not board or len(board) != 9 or any(len(row) != 9 for row in board):
        return jsonify({"error": "Invalid board format"}), 400

    board_copy = [row[:] for row in board]

    if solve_sudoku(board_copy):
        return jsonify({"solved": True, "board": board_copy})
    else:
        return jsonify({"solved": False, "error": "No solution exists for this puzzle"}), 200