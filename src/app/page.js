"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Board from '../components/Board';
import Leaderboard from '../components/Leaderboard';
import { createBoard, getValidMoves, playMove, isGameOver, getScore, BLACK, WHITE } from '../lib/reversi';
import { getUserBot, saveUserBot, fetchUsers, updateUserElo, addMatchRecord } from '../lib/db';
import { calculateElo } from '../lib/elo';

const DEFAULT_BOT_CODE = `// Get the best score directly
const valid = getValidMoves(board, myPlayer);
if(valid.length === 0) return null;
return valid[Math.floor(Math.random() * valid.length)];`;

export default function Arena() {
  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(BLACK);
  const [validMoves, setValidMoves] = useState([]);
  const [botCode, setBotCode] = useState(DEFAULT_BOT_CODE);
  const [gameMode, setGameMode] = useState('Player_vs_AI');
  const [statusText, setStatusText] = useState('Select mode and start game.');
  const [gameActive, setGameActive] = useState(false);
  const [users, setUsers] = useState([]);
  const [opponentId, setOpponentId] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isAutoRun, setIsAutoRun] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const workerRef = useRef(null);
  const opponentWorkerRef = useRef(null);
  const boardRef = useRef([]);
  const sysAiCodeRef = useRef("return null;");
  const opponentCodeRef = useRef("return null;");
  boardRef.current = board;

  // Load initial data (async)
  useEffect(() => {
    setBoard(createBoard());

    async function init() {
      // Load user list
      const allUsers = await fetchUsers();
      setUsers(allUsers);

      // Determine current user id (first non-bot, non-system user)
      const me = allUsers.find(u => !u.isBot && u.username !== 'System AI');
      const myId = me ? me.id : null;
      setCurrentUserId(myId);

      // Load my bot code
      if (myId) {
        const bot = await getUserBot(myId);
        if (bot) setBotCode(bot.code);
      }

      // Pre-load System AI code
      const sysBot = await getUserBot('1');
      if (sysBot) sysAiCodeRef.current = sysBot.code;
    }
    init();

    workerRef.current = new Worker('/workers/botWorker.js');
    opponentWorkerRef.current = new Worker('/workers/botWorker.js');
    return () => {
      workerRef.current?.terminate();
      opponentWorkerRef.current?.terminate();
    };
  }, []);

  const handleGameOver = useCallback(async (currentBoard) => {
    const scores = getScore(currentBoard);
    const blackScore = scores[BLACK];
    const whiteScore = scores[WHITE];
    setStatusText("Game Over! Black: " + blackScore + " | White: " + whiteScore);
    setGameActive(false);
    setIsAutoRun(false);

    if ((gameMode === 'Bot_vs_AI' || gameMode === 'Bot_vs_Bot' || gameMode === 'Player_vs_Bot') && currentUserId) {
      const allUsers = await fetchUsers();
      const meId = currentUserId;
      const opId = (gameMode === 'Bot_vs_Bot' || gameMode === 'Player_vs_Bot') && opponentId ? opponentId : '1';

      const me = allUsers.find(u => u.id === meId);
      const op = allUsers.find(u => u.id === opId);

      if (me && op) {
        const scoreMe = blackScore > whiteScore ? 1 : blackScore === whiteScore ? 0.5 : 0;
        const scoreOp = 1 - scoreMe;
        const [newMe, newOp] = calculateElo(me.elo, op.elo, scoreMe, scoreOp);

        await updateUserElo(meId, newMe);
        await updateUserElo(opId, newOp);
        await addMatchRecord({ playerId: meId, opponentId: opId, scoreMe, myElo: newMe, opElo: newOp });

        const refreshed = await fetchUsers();
        setUsers(refreshed);
        setTimeout(() => {
          alert(`Match Recorded! Your new ELO: ${newMe} (was ${me.elo})`);
        }, 100);
      }
    }
  }, [gameMode, opponentId, currentUserId]);

  const runAI_System = useCallback(async (b, player) => {
    return new Promise((resolve) => {
      const id = Date.now() + 'sys';
      const code = sysAiCodeRef.current;

      const onMsg = (e) => {
        if (e.data.id === id) {
          opponentWorkerRef.current.removeEventListener('message', onMsg);
          if (e.data.success) {
            resolve(e.data.move);
          } else {
            console.error('System AI Error:', e.data.error);
            const fallback = getValidMoves(b, player);
            resolve(fallback.length > 0 ? fallback[Math.floor(Math.random() * fallback.length)] : null);
          }
        }
      };
      opponentWorkerRef.current.addEventListener('message', onMsg);
      opponentWorkerRef.current.postMessage({ id, code, state: { board: b }, myPlayer: player });
    });
  }, []);

  const runAI_Opponent = useCallback(async (b, player) => {
    return new Promise((resolve) => {
      const id = Date.now();
      const code = opponentCodeRef.current;

      const onMsg = (e) => {
        if (e.data.id === id) {
          opponentWorkerRef.current.removeEventListener('message', onMsg);
          if (e.data.success) {
            resolve(e.data.move);
          } else {
            console.error('Opponent Bot Error:', e.data.error);
            resolve(null);
          }
        }
      };
      opponentWorkerRef.current.addEventListener('message', onMsg);
      opponentWorkerRef.current.postMessage({ id, code, state: { board: b }, myPlayer: player });
    });
  }, []);

  const runAI_User = useCallback(async (b, player) => {
    return new Promise((resolve) => {
      const id = Date.now();
      const onMsg = (e) => {
        if (e.data.id === id) {
          workerRef.current.removeEventListener('message', onMsg);
          if (e.data.success) {
            resolve(e.data.move);
          } else {
            console.error('Bot Error:', e.data.error);
            setStatusText('Bot Error! Check console.');
            resolve(null);
          }
        }
      };
      workerRef.current.addEventListener('message', onMsg);
      workerRef.current.postMessage({ id, code: botCode, state: { board: b }, myPlayer: player });
    });
  }, [botCode]);

  useEffect(() => {
    if (board.length === 0 || !gameActive) return;
    const moves = getValidMoves(board, currentPlayer);
    setValidMoves(moves);

    if (moves.length === 0) {
      if (isGameOver(board)) {
        handleGameOver(board);
      } else {
        const playerName = currentPlayer === BLACK ? 'Black' : 'White';
        setStatusText("Player " + playerName + " has no moves. Skipping.");
        setTimeout(() => setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK), 1500);
      }
      return;
    }

    const playerName = currentPlayer === BLACK ? 'Black' : 'White';
    setStatusText("Turn: " + playerName);

    // AI Turn (System is White = 2)
    if (currentPlayer === WHITE) {
      if (gameMode === 'Player_vs_AI' || gameMode === 'Bot_vs_AI') {
        runAI_System(board, WHITE).then(move => {
          if (move) {
            const newBoard = playMove(boardRef.current, move.row, move.col, WHITE);
            if (newBoard) {
              setTimeout(() => {
                setBoard(newBoard);
                setCurrentPlayer(BLACK);
              }, 500);
            }
          }
        });
      } else if (gameMode === 'Bot_vs_Bot' || gameMode === 'Player_vs_Bot') {
        runAI_Opponent(board, WHITE).then(move => {
          if (move) {
            const newBoard = playMove(boardRef.current, move.row, move.col, WHITE);
            if (newBoard) {
              setTimeout(() => {
                setBoard(newBoard);
                setCurrentPlayer(BLACK);
              }, 500);
            }
          } else {
            const fallbackMove = moves[Math.floor(Math.random() * moves.length)];
            const newBoard = playMove(boardRef.current, fallbackMove.row, fallbackMove.col, WHITE);
            if (newBoard) { setTimeout(() => { setBoard(newBoard); setCurrentPlayer(BLACK); }, 500); }
          }
        });
      }
    } else if (currentPlayer === BLACK && gameMode === 'Bot_vs_Bot') {
      runAI_User(board, BLACK).then(move => {
        if (move) {
          const newBoard = playMove(boardRef.current, move.row, move.col, BLACK);
          if (newBoard) {
            setTimeout(() => {
              setBoard(newBoard);
              setCurrentPlayer(WHITE);
            }, 500);
          }
        }
      });
    }
  }, [currentPlayer, board, gameMode, gameActive, handleGameOver, runAI_System, runAI_Opponent, runAI_User]);

  const handleBotStep = useCallback(() => {
    if (board.length === 0 || !gameActive || currentPlayer !== BLACK || isThinking) return;
    setIsThinking(true);
    runAI_User(board, BLACK).then(move => {
      setIsThinking(false);
      if (move) {
        const newBoard = playMove(boardRef.current, move.row, move.col, BLACK);
        if (newBoard) {
          setBoard(newBoard);
          setCurrentPlayer(WHITE);
        }
      }
    });
  }, [board, gameActive, currentPlayer, isThinking, runAI_User]);

  useEffect(() => {
    if (gameActive && gameMode === 'Bot_vs_AI' && currentPlayer === BLACK && isAutoRun && !isThinking) {
      const timer = setTimeout(() => {
        handleBotStep();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [gameActive, gameMode, currentPlayer, isAutoRun, isThinking, handleBotStep]);

  const handlePlayerMove = (r, c) => {
    if (currentPlayer === BLACK && (gameMode === 'Player_vs_AI' || gameMode === 'Player_vs_Bot') && gameActive) {
      const newBoard = playMove(board, r, c, BLACK);
      if (newBoard) {
        setBoard(newBoard);
        setCurrentPlayer(WHITE);
      }
    }
  };

  const handleSaveBot = async () => {
    if (!currentUserId) {
      alert('No user profile found. Please register first.');
      return;
    }
    await saveUserBot(currentUserId, botCode);
    const refreshed = await fetchUsers();
    setUsers(refreshed);
    alert('Bot script saved!');
  };

  const startGame = (mode) => {
    setGameMode(mode);
    setBoard(createBoard());
    setCurrentPlayer(BLACK);
    setGameActive(true);
    setIsThinking(false);
    setIsAutoRun(false);
    setStatusText('Game Started!');
  };

  const handleChallenge = async (oppId) => {
    const allUsers = await fetchUsers();
    const oppUser = allUsers.find(u => u.id === oppId);
    if (!oppUser) return;

    // Pre-load opponent bot code
    const oppBot = await getUserBot(oppId);
    opponentCodeRef.current = oppBot ? oppBot.code : "return null;";

    setOpponentId(oppId);
    setGameMode('Player_vs_Bot');
    setBoard(createBoard());
    setCurrentPlayer(BLACK);
    setGameActive(true);
    setStatusText(`Challenge: You vs ${oppUser.username} (click to play)`);
  };

  return (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* Main Content Column for Game and Bot */}
      <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '40px', minWidth: '450px' }}>
        
        <div className="glass-panel">
          <h2>Arena</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{statusText}</p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => startGame('Player_vs_AI')}>Play Manually</button>
            <button onClick={() => startGame('Bot_vs_AI')} style={{ background: 'var(--accent)' }}>Deploy Bot vs System AI</button>
          </div>

          <Board board={board} validMoves={gameActive ? validMoves : []} onMove={handlePlayerMove} player={currentPlayer} />

          {gameMode === 'Bot_vs_AI' && gameActive && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={handleBotStep} 
                disabled={isThinking || currentPlayer !== BLACK || isAutoRun}
                style={{ 
                  background: (isThinking || currentPlayer !== BLACK || isAutoRun) ? 'var(--surface-hover)' : 'var(--primary)', 
                  padding: '10px 30px', 
                  fontSize: '1rem', 
                  minWidth: '150px',
                  cursor: (isThinking || currentPlayer !== BLACK || isAutoRun) ? 'not-allowed' : 'pointer',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s'
                }}>
                {isThinking && currentPlayer === BLACK ? 'Thinking...' : 'Next Step'}
              </button>
              
              <button 
                onClick={() => setIsAutoRun(!isAutoRun)} 
                style={{ 
                  background: isAutoRun ? '#ef4444' : '#10b981', 
                  padding: '10px 20px', 
                  fontSize: '1rem', 
                  minWidth: '120px',
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s'
                }}>
                {isAutoRun ? 'Stop Auto' : 'Auto Run'}
              </button>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>Next-Step Algorithm (Bot)</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.9rem' }}>
            Write a javascript function body. It receives <code>board</code> (2D array) and <code>myPlayer</code> (1 or 2). <br/>
            Must return <code>{'{ row, col }'}</code>.
          </p>

          <textarea
            value={botCode}
            onChange={e => setBotCode(e.target.value)}
            style={{
              width: '100%', height: '250px',
              background: 'rgba(0,0,0,0.3)', color: '#00ffcc',
              border: '1px solid var(--border)', borderRadius: '8px',
              padding: '16px', fontFamily: 'monospace', fontSize: '14px',
              resize: 'vertical', marginBottom: '20px'
            }}
          />
          <div style={{ display: 'flex' }}>
             <button onClick={handleSaveBot}>Save Algorithm</button>
          </div>
        </div>
      </div>

      {/* Right Sidebar Column */}
      <Leaderboard users={users} onChallenge={handleChallenge} />

    </div>
  );
}
