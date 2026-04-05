/**
 * Shared seed data and helpers for KV.
 */

const MCTS_CODE = `
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
const rootNode = { board, playerToMove: myPlayer, unexploredMoves: [...rootMoves], children: [], visits: 0, wins: 0 };
const ITERATIONS = 250;
for(let i=0; i<ITERATIONS; i++) {
  let node = rootNode; let path = [node];
  while(node.unexploredMoves.length === 0 && node.children.length > 0) {
    let bestUcb = -Infinity; let nextNode = null;
    for(let child of node.children) {
      const ucb = (child.wins / child.visits) + 1.414 * Math.sqrt(Math.log(node.visits) / child.visits);
      if(ucb > bestUcb) { bestUcb = ucb; nextNode = child; }
    }
    node = nextNode; path.push(node);
  }
  if(node.unexploredMoves.length > 0) {
    const idx = Math.floor(Math.random() * node.unexploredMoves.length);
    const move = node.unexploredMoves.splice(idx, 1)[0];
    const nextBoard = playSimMove(node.board, move.row, move.col, node.playerToMove);
    const opp = 3 - node.playerToMove;
    let nextPlayer = opp;
    let nextValid = getValidMoves(nextBoard, opp);
    if(nextValid.length === 0) {
      nextValid = getValidMoves(nextBoard, node.playerToMove);
      if(nextValid.length > 0) nextPlayer = node.playerToMove; else nextPlayer = 0;
    }
    const childNode = { board: nextBoard, playerToMove: nextPlayer, unexploredMoves: nextPlayer !== 0 ? [...nextValid] : [], children: [], visits: 0, wins: 0, movePlayedBy: node.playerToMove, triggerMove: move };
    node.children.push(childNode); node = childNode; path.push(node);
  }
  let simBoard = node.board; let simPlayer = node.playerToMove; let passes = 0;
  while(passes < 2 && simPlayer !== 0) {
    const vMoves = getValidMoves(simBoard, simPlayer);
    if(vMoves.length > 0) { passes = 0; const rMove = vMoves[Math.floor(Math.random() * vMoves.length)]; simBoard = playSimMove(simBoard, rMove.row, rMove.col, simPlayer); simPlayer = 3 - simPlayer; }
    else { passes++; simPlayer = 3 - simPlayer; }
  }
  const scores = getScore(simBoard);
  for(let pNode of path) { pNode.visits++; if(pNode.movePlayedBy) { const pScore = scores[pNode.movePlayedBy]; const oppScore = scores[3 - pNode.movePlayedBy]; if(pScore > oppScore) pNode.wins += 1; else if(pScore === oppScore) pNode.wins += 0.5; } }
}
let bestMove = null; let maxVisits = -1;
for(let child of rootNode.children) { if(child.visits > maxVisits) { maxVisits = child.visits; bestMove = child.triggerMove; } }
return bestMove;
`;

const ALPHA_CODE = `const validMoves = getValidMoves(board, myPlayer);
if (validMoves.length === 0) return null;
return validMoves[0];`;

export const SEED_USERS = [
  { id: '1', username: 'System AI', elo: 1200, isBot: true },
  { id: '3', username: 'AlphaReversi', elo: 1400, isBot: false },
];

export const SEED_BOTS = [
  { id: 'bot_sys_1', userId: '1', name: 'MCTS AI', code: MCTS_CODE },
  { id: 'bot_usr_3', userId: '3', name: 'AlphaReversi Code', code: ALPHA_CODE },
];

export async function ensureSeeded(kv) {
  let usersRaw = await kv.get('users');
  if (!usersRaw) {
    await kv.put('users', JSON.stringify(SEED_USERS));
    for (const bot of SEED_BOTS) {
      await kv.put(`bot:${bot.userId}`, JSON.stringify(bot));
    }
    await kv.put('matches', JSON.stringify([]));
    return SEED_USERS;
  }
  return JSON.parse(usersRaw);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
