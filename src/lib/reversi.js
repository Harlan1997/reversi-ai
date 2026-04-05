export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export function createBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

export function isValidMove(board, row, col, player) {
  if (row < 0 || row >= 8 || col < 0 || col >= 8 || board[row][col] !== EMPTY) {
    return false;
  }

  const opponent = player === BLACK ? WHITE : BLACK;
  let isValid = false;

  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    let foundOpponent = false;

    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent) {
      foundOpponent = true;
      r += dr;
      c += dc;
    }

    if (foundOpponent && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
      isValid = true;
      break;
    }
  }

  return isValid;
}

export function playMove(board, row, col, player) {
  if (!isValidMove(board, row, col, player)) {
    return null; // Invalid move
  }

  // Create a deep copy of the board to return a new state
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;
  const opponent = player === BLACK ? WHITE : BLACK;

  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    let foundOpponent = false;
    let toFlip = [];

    while (r >= 0 && r < 8 && c >= 0 && c < 8 && newBoard[r][c] === opponent) {
      foundOpponent = true;
      toFlip.push([r, c]);
      r += dr;
      c += dc;
    }

    if (foundOpponent && r >= 0 && r < 8 && c >= 0 && c < 8 && newBoard[r][c] === player) {
      for (const [fr, fc] of toFlip) {
        newBoard[fr][fc] = player;
      }
    }
  }

  return newBoard;
}

export function getValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isValidMove(board, r, c, player)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

export function hasValidMoves(board, player) {
  return getValidMoves(board, player).length > 0;
}

export function isGameOver(board) {
  return !hasValidMoves(board, BLACK) && !hasValidMoves(board, WHITE);
}

export function getScore(board) {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === BLACK) black++;
      if (board[r][c] === WHITE) white++;
    }
  }
  return { [BLACK]: black, [WHITE]: white };
}
