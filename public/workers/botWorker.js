// Web Worker for safe, isolated evaluation of Bot Algorithms

self.onmessage = function (e) {
  const { id, code, state, myPlayer } = e.data;

  try {
    // We construct a scoped function that takes board and player arguments
    // User code is evaluated within this function block.
    // Ensure the code defines a function that returns an object { row, col }
    
    // Example User Code:
    // "let valid = getValidMoves(board, myPlayer); return valid[0];"
    // Wait, the user might actually write a named function or anonymous function or just logic.
    // It is easiest if we provide a wrapper:
    // `return (function(board, myPlayer) { ${code} })(state.board, myPlayer);`

    const logicWrapper = new Function('board', 'myPlayer', `
      // Utility functions for the user
      function getValidMoves(b, p) {
        let moves = [];
        for(let r=0; r<8; r++){
          for(let c=0; c<8; c++){
            if(isValidUserMove(b, r, c, p)) moves.push({row: r, col: c});
          }
        }
        return moves;
      }
      function isValidUserMove(b, r, c, p) {
        if(b[r][c] !== 0) return false;
        const op = p === 1 ? 2 : 1;
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for(let [dr, dc] of dirs) {
          let rr = r+dr, cc = c+dc;
          let foundOp = false;
          while(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr][cc]===op){
            foundOp = true;
            rr+=dr; cc+=dc;
          }
          if(foundOp && rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr][cc]===p) return true;
        }
        return false;
      }
      
      try {
        ${code}
      } catch (err) {
        throw new Error("Bot Error: " + err.message);
      }
    `);

    // Add a timer to prevent infinite loops (Note: Web workers can't easily timeout their own eval 
    // unless another thread terminates them, so the main thread should handle timeouts).
    const move = logicWrapper(state.board, myPlayer);

    self.postMessage({ id, success: true, move });

  } catch (err) {
    self.postMessage({ id, success: false, error: err.toString() });
  }
};
