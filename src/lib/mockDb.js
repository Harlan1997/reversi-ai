/**
 * A mock database for the MVP of the Reversi AI Platform.
 * In a real Cloudflare deployment, this would use D1 or KV binding.
 */

const DB_KEY = 'reversi_platform_db';

export function getDb() {
  if (typeof window === 'undefined') return { users: [], bots: [], matches: [] };
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);

  // Initialize with Default AI and dummy users
  const sysAiCode = `
function playSimMove(b, r, c, p) {
  let nb = b.map(row => [...row]);
  nb[r][c] = p;
  const op = p === 1 ? 2 : 1;
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for(let [dr, dc] of dirs) {
    let rr = r+dr, cc = c+dc;
    let flips = [];
    while(rr>=0&&rr<8&&cc>=0&&cc<8&&nb[rr][cc]===op){
      flips.push([rr, cc]);
      rr+=dr; cc+=dc;
    }
    if(flips.length>0 && rr>=0&&rr<8&&cc>=0&&cc<8&&nb[rr][cc]===p) {
      for(let [fr, fc] of flips) nb[fr][fc] = p;
    }
  }
  return nb;
}

function getScore(b) {
  let s1=0, s2=0;
  for(let r=0; r<8; r++) for(let c=0; c<8; c++) {
    if(b[r][c]===1) s1++;
    else if(b[r][c]===2) s2++;
  }
  return {1:s1, 2:s2};
}

const rootMoves = getValidMoves(board, myPlayer);
if (rootMoves.length === 0) return null;
if (rootMoves.length === 1) return rootMoves[0];

const rootNode = {
  board, playerToMove: myPlayer, unexploredMoves: [...rootMoves],
  children: [], visits: 0, wins: 0
};

// MCTS algorithm implementation
const ITERATIONS = 250;
for(let i=0; i<ITERATIONS; i++) {
  let node = rootNode;
  let path = [node];
  
  // Selection
  while(node.unexploredMoves.length === 0 && node.children.length > 0) {
    let bestUcb = -Infinity;
    let nextNode = null;
    for(let child of node.children) {
      const ucb = (child.wins / child.visits) + 1.414 * Math.sqrt(Math.log(node.visits) / child.visits);
      if(ucb > bestUcb) { bestUcb = ucb; nextNode = child; }
    }
    node = nextNode;
    path.push(node);
  }
  
  // Expansion
  if(node.unexploredMoves.length > 0) {
    const idx = Math.floor(Math.random() * node.unexploredMoves.length);
    const move = node.unexploredMoves.splice(idx, 1)[0];
    const nextBoard = playSimMove(node.board, move.row, move.col, node.playerToMove);
    const opp = 3 - node.playerToMove;
    let nextPlayer = opp;
    let nextValid = getValidMoves(nextBoard, opp);
    if(nextValid.length === 0) {
      nextValid = getValidMoves(nextBoard, node.playerToMove);
      if(nextValid.length > 0) nextPlayer = node.playerToMove;
      else nextPlayer = 0;
    }
    const childNode = {
      board: nextBoard, playerToMove: nextPlayer, unexploredMoves: nextPlayer !== 0 ? [...nextValid] : [],
      children: [], visits: 0, wins: 0, movePlayedBy: node.playerToMove, triggerMove: move
    };
    node.children.push(childNode);
    node = childNode;
    path.push(node);
  }
  
  // Simulation
  let simBoard = node.board;
  let simPlayer = node.playerToMove;
  let passes = 0;
  while(passes < 2 && simPlayer !== 0) {
    const vMoves = getValidMoves(simBoard, simPlayer);
    if(vMoves.length > 0) {
      passes = 0;
      const rMove = vMoves[Math.floor(Math.random() * vMoves.length)];
      simBoard = playSimMove(simBoard, rMove.row, rMove.col, simPlayer);
      simPlayer = 3 - simPlayer;
    } else {
      passes++;
      simPlayer = 3 - simPlayer;
    }
  }
  
  // Backpropagation
  const scores = getScore(simBoard);
  for(let pNode of path) {
    pNode.visits++;
    if(pNode.movePlayedBy) {
      const pScore = scores[pNode.movePlayedBy];
      const oppScore = scores[3 - pNode.movePlayedBy];
      if(pScore > oppScore) pNode.wins += 1;
      else if(pScore === oppScore) pNode.wins += 0.5;
    }
  }
}

let bestMove = null;
let maxVisits = -1;
for(let child of rootNode.children) {
  if(child.visits > maxVisits) { maxVisits = child.visits; bestMove = child.triggerMove; }
}
return bestMove;
  `;

  const alphaRevCode = "const validMoves = getValidMoves(board, myPlayer);\nif (validMoves.length === 0) return null;\nreturn validMoves[0]; // just return the first valid move for sim";

  const initialDb = {
    users: [
      { id: '1', username: 'System AI', elo: 1200, isBot: true },
      { id: '2', username: 'Player (You)', elo: 1000, isBot: false },
      { id: '3', username: 'AlphaReversi', elo: 1400, isBot: false }
    ],
    bots: [
      { id: 'bot_sys_1', userId: '1', name: 'MCTS AI', code: sysAiCode },
      { id: 'bot_usr_3', userId: '3', name: 'AlphaReversi Code', code: alphaRevCode }
    ],
    matches: []
  };
  localStorage.setItem(DB_KEY, JSON.stringify(initialDb));
  return initialDb;
}

export function saveDb(db) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
}

export function fetchUsers() {
  let db = getDb();
  
  // Migration code: silently insert Dummy User 3 if not fully loaded from earlier turns
  if (!db.users.find(u => u.id === '3')) {
     db.users.push({ id: '3', username: 'AlphaReversi', elo: 1400, isBot: false });
     db.bots.push({
        id: 'bot_usr_3', userId: '3', name: 'AlphaReversi Code',
        code: "const validMoves = getValidMoves(board, myPlayer);\nif (validMoves.length === 0) return null;\nreturn validMoves[0];"
     });
     saveDb(db);
  }

  // Update System AI if schema is old
  let sysBot = db.bots.find(b => b.userId === '1');
  if (sysBot && !sysBot.code.includes('ITERATIONS')) {
    // Inject MCTS code gracefully into existing cached mock DB so we dont have to clear localstorage
    sysBot.code = getDb().bots.find(b => b.userId === '1').code; // re-run generator
    saveDb(db);
  }

  return db.users
    .map(u => ({ ...u, hasBot: !!db.bots.find(b => b.userId === u.id) }))
    .sort((a, b) => b.elo - a.elo);
}

export function updateUserElo(userId, newElo) {
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.elo = newElo;
    saveDb(db);
  }
}

export function addMatchRecord(match) {
  const db = getDb();
  db.matches.push({ ...match, date: new Date().toISOString() });
  saveDb(db);
}

export function saveUserBot(userId, botCode) {
  const db = getDb();
  const botIndex = db.bots.findIndex(b => b.userId === userId);
  if (botIndex >= 0) {
    db.bots[botIndex].code = botCode;
  } else {
    db.bots.push({ id: `bot_${Date.now()}`, userId, name: 'My Custom Bot', code: botCode });
  }
  saveDb(db);
}

export function getUserBot(userId) {
  const db = getDb();
  return db.bots.find(b => b.userId === userId);
}
