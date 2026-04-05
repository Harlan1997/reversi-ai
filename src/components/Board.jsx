"use client";

import React from 'react';
import styles from './Board.module.css';

export default function Board({ board, onMove, validMoves }) {
  const handleCellClick = (r, c) => {
    if (onMove && validMoves.some(m => m.row === r && m.col === c)) {
      onMove(r, c);
    }
  };

  if (!board || board.length === 0) return null;

  return (
    <div className={styles.boardContainer}>
      <div className={styles.grid}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isValid = validMoves.some(m => m.row === r && m.col === c);
            const isBlack = cell === 1;
            const isWhite = cell === 2;
            return (
              <div
                key={r + '-' + c}
                className={styles.cell}
                onClick={() => handleCellClick(r, c)}
              >
                {isValid && <div className={styles.validHint}></div>}
                {(isBlack || isWhite) && (
                  <div className={styles.disc + ' ' + (isBlack ? styles.discBlack : styles.discWhite)}></div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
