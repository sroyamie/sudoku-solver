from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def is_valid(board, row, col, num):
    # Check row
    for x in range(9):
        if board[row][x] == num:
            return False

    # Check column
    for x in range(9):
        if board[x][col] == num:
            return False

    # Check 3x3 box
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
                        board[row][col] = 0  # backtrack
                return False  # no valid number found, trigger backtrack
    return True  # all cells filled, solved!

@app.route("/solve", methods=["POST"])
def solve():
    data = request.get_json()
    board = data.get("board")

    # Basic validation
    if not board or len(board) != 9 or any(len(row) != 9 for row in board):
        return jsonify({"error": "Invalid board format"}), 400

    # Make a copy so we don't mutate the original unexpectedly
    board_copy = [row[:] for row in board]

    if solve_sudoku(board_copy):
        return jsonify({"solved": True, "board": board_copy})
    else:
        return jsonify({"solved": False, "error": "No solution exists for this puzzle"}), 200

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", debug=True, port=port)