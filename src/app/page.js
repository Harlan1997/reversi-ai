"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Board from '../components/Board';
import Leaderboard from '../components/Leaderboard';
import { createBoard, getValidMoves, playMove, isGameOver, getScore, BLACK, WHITE } from '../lib/reversi';
import { getUserBot, saveUserBot, fetchUsers, updateUserElo, addMatchRecord, registerUser } from '../lib/db';
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
  const [currentUsername, setCurrentUsername] = useState('');
  const [opponentName, setOpponentName] = useState('System AI');
  const [showRegister, setShowRegister] = useState(false);
  const [registerInput, setRegisterInput] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
      // Check if user already registered (stored in localStorage)
      const savedUserId = localStorage.getItem('reversi_user_id');
      const savedUsername = localStorage.getItem('reversi_username');

      // Load user list
      const allUsers = await fetchUsers();
      setUsers(allUsers);

      if (savedUserId && savedUsername) {
        // Verify user still exists in DB
        const existing = allUsers.find(u => u.id === savedUserId);
        if (existing) {
          setCurrentUserId(savedUserId);
          setCurrentUsername(savedUsername);
          // Load my bot code
          const bot = await getUserBot(savedUserId);
          if (bot) setBotCode(bot.code);
        } else {
          // Stale session — ask to register again
          localStorage.removeItem('reversi_user_id');
          localStorage.removeItem('reversi_username');
          setShowRegister(true);
        }
      } else {
        // First time visitor — show registration
        setShowRegister(true);
      }

      // Pre-load System AI code
      const sysBot = await getUserBot('1');
      if (sysBot) sysAiCodeRef.current = sysBot.code;

      setIsLoading(false);
    }
    init();

    workerRef.current = new Worker('/workers/botWorker.js');
    opponentWorkerRef.current = new Worker('/workers/botWorker.js');
    return () => {
      workerRef.current?.terminate();
      opponentWorkerRef.current?.terminate();
    };
  }, []);

  const handleRegister = async () => {
    const name = registerInput.trim();
    if (!name) { setRegisterError('Please enter a username.'); return; }
    if (name.length < 2) { setRegisterError('Username must be at least 2 characters.'); return; }

    try {
      const newUser = await registerUser(name);
      localStorage.setItem('reversi_user_id', newUser.id);
      localStorage.setItem('reversi_username', name);
      setCurrentUserId(newUser.id);
      setCurrentUsername(name);
      setShowRegister(false);
      setRegisterError('');
      // Refresh user list
      const allUsers = await fetchUsers();
      setUsers(allUsers);
    } catch (err) {
      setRegisterError(err.message);
    }
  };

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
    if (gameActive && (gameMode === 'Bot_vs_AI' || gameMode === 'Bot_vs_Bot') && currentPlayer === BLACK && isAutoRun && !isThinking) {
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

  const handleForfeit = async () => {
    // Only apply forfeit penalty if it's an active, ranked match against a real user
    if (gameActive && currentUserId && opponentId && opponentId !== currentUserId && opponentId !== '1' && (gameMode === 'Player_vs_Bot' || gameMode === 'Bot_vs_Bot')) {
      
      // Check if board is in initial state (only 4 pieces)
      let piecesCount = 0;
      if (board && board.length) {
        for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(board[r][c] !== 0) piecesCount++;
      }
      if (piecesCount <= 4) return; // Haven't started yet, no penalty

      const allUsers = await fetchUsers();
      const me = allUsers.find(u => u.id === currentUserId);
      const op = allUsers.find(u => u.id === opponentId);
      if (me && op) {
        // me scores 0, op scores 1
        const [newMe, newOp] = calculateElo(me.elo, op.elo, 0, 1);
        await updateUserElo(currentUserId, newMe);
        await updateUserElo(opponentId, newOp);
        await addMatchRecord({ playerId: currentUserId, opponentId, scoreMe: 0, myElo: newMe, opElo: newOp });
        const refreshed = await fetchUsers();
        setUsers(refreshed);
        alert(`You forfeited the match! Elo penalty applied: ${newMe} (was ${me.elo})`);
      }
    }
  };

  const startGame = async (mode) => {
    await handleForfeit();
    setGameMode(mode);
    setBoard(createBoard());
    setCurrentPlayer(BLACK);
    setGameActive(true);
    setIsThinking(false);
    setIsAutoRun(false);
    setOpponentName('System AI');
    setOpponentId('1');
    setStatusText('Game Started!');
  };

  const restartMatch = async (mode) => {
    await handleForfeit();
    setGameMode(mode);
    setBoard(createBoard());
    setCurrentPlayer(BLACK);
    setGameActive(true);
    setIsThinking(false);
    setIsAutoRun(false);
    setStatusText(`Match Started: ${mode === 'Bot_vs_Bot' ? 'Your Bot' : 'You'} vs ${opponentName}`);
  };

  const handleChallenge = async (oppId) => {
    const allUsers = await fetchUsers();
    const oppUser = allUsers.find(u => u.id === oppId);
    if (!oppUser) return;

    await handleForfeit();

    // Pre-load opponent bot code
    const oppBot = await getUserBot(oppId);
    opponentCodeRef.current = oppBot ? oppBot.code : "return null;";

    setOpponentId(oppId);
    setOpponentName(oppUser.username);
    setGameMode('Player_vs_Bot');
    setBoard(createBoard());
    setCurrentPlayer(BLACK);
    setGameActive(true);
    setStatusText(`Challenge: You vs ${oppUser.username} (click to play)`);
  };

  // Get display name for black player
  const getBlackName = () => {
    if (gameMode === 'Player_vs_AI' || gameMode === 'Player_vs_Bot' || gameMode === 'Bot_vs_AI' || gameMode === 'Bot_vs_Bot') {
      return currentUsername || 'You';
    }
    return 'Black';
  };

  const getWhiteName = () => {
    if (gameMode === 'Player_vs_Bot' || gameMode === 'Bot_vs_Bot') {
      return opponentName;
    }
    return 'System AI';
  };

  // -------------------------------------------------------------------------
  // Registration modal
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Loading...</p>
      </div>
    );
  }

  if (showRegister) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '8px' }}>⬡ Welcome to Reversi AI</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Choose a username to join the arena and compete.
          </p>
          <input
            type="text"
            placeholder="Enter your username"
            value={registerInput}
            onChange={e => setRegisterInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            autoFocus
            style={{
              width: '100%', padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)', color: '#fff',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '1rem', marginBottom: '12px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {registerError && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{registerError}</p>
          )}
          <button
            onClick={handleRegister}
            style={{
              width: '100%', padding: '12px',
              background: 'var(--primary)', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            Enter Arena
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main arena UI
  // -------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* Main Content Column for Game and Bot */}
      <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '40px', minWidth: '450px' }}>
        
        <div className="glass-panel">
          <h2>Arena</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>{statusText}</p>

          {/* Player labels */}
          {gameActive && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '16px', padding: '10px 16px',
              background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
              fontSize: '0.95rem',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: currentPlayer === BLACK ? 1 : 0.4,
                fontWeight: currentPlayer === BLACK ? 'bold' : 'normal',
                transition: 'opacity 0.3s',
              }}>
                <span style={{
                  display: 'inline-block', width: '16px', height: '16px',
                  borderRadius: '50%', background: '#111', border: '2px solid #888',
                }}></span>
                <span>{getBlackName()}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Black)</span>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>vs</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: currentPlayer === WHITE ? 1 : 0.4,
                fontWeight: currentPlayer === WHITE ? 'bold' : 'normal',
                transition: 'opacity 0.3s',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(White)</span>
                <span>{getWhiteName()}</span>
                <span style={{
                  display: 'inline-block', width: '16px', height: '16px',
                  borderRadius: '50%', background: '#eee', border: '2px solid #888',
                }}></span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => (opponentId && opponentId !== '1') ? restartMatch('Player_vs_Bot') : startGame('Player_vs_AI')}>
              Play Manually {opponentId && opponentId !== '1' ? `vs ${opponentName}` : ''}
            </button>
            <button onClick={() => (opponentId && opponentId !== '1') ? restartMatch('Bot_vs_Bot') : startGame('Bot_vs_AI')} style={{ background: 'var(--accent)' }}>
              Deploy Bot {opponentId && opponentId !== '1' ? `vs ${opponentName}'s AI` : 'vs System AI'}
            </button>
            {opponentId && opponentId !== '1' && (
              <button onClick={() => startGame('Player_vs_AI')} style={{ background: 'var(--surface-hover)' }}>
                Cancel Challenge
              </button>
            )}
            {gameActive && (gameMode === 'Player_vs_Bot' || gameMode === 'Bot_vs_Bot') && opponentId && opponentId !== currentUserId && opponentId !== '1' && (
              <button 
                onClick={async () => { await handleForfeit(); setGameActive(false); setStatusText('Match Resigned.'); }} 
                style={{ background: '#ef4444' }}>
                Resign Match
              </button>
            )}
          </div>

          <Board board={board} validMoves={gameActive ? validMoves : []} onMove={handlePlayerMove} player={currentPlayer} />

          {(gameMode === 'Bot_vs_AI' || gameMode === 'Bot_vs_Bot') && gameActive && (
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
      <Leaderboard users={users} onChallenge={handleChallenge} currentUserId={currentUserId} />

    </div>
  );
}
