import React from 'react';

export default function Leaderboard({ users, onChallenge, currentUserId }) {
  return (
    <div className="glass-panel" style={{ flex: '1', minWidth: '350px', maxWidth: '450px', height: 'fit-content' }}>
      <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Global Leaderboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 60px 80px', gap: '10px', padding: '10px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <div>Rank</div>
        <div>Player</div>
        <div>Elo</div>
        <div>Action</div>
      </div>

      {users.map((u, index) => (
        <div key={u.id} style={{
          display: 'grid', gridTemplateColumns: '50px 1fr 60px 80px', gap: '10px',
          padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: index === 0 ? 'linear-gradient(90deg, rgba(255, 71, 133, 0.1) 0%, transparent 100%)' : 'transparent',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: index === 0 ? 'var(--accent)' : 'inherit' }}>
            #{index + 1}
          </div>
          <div>
            <span style={{ fontSize: '1.1rem' }}>{u.username}</span>
            {u.isBot && <div style={{ marginTop: '4px', fontSize: '0.7rem', padding: '2px 6px', background: 'var(--surface-hover)', borderRadius: '4px', display: 'inline-block' }}>System AI</div>}
          </div>
          <div style={{ fontWeight: 'bold' }}>
            {u.elo}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
            {u.hasBot && u.id !== currentUserId && (
              <button
                onClick={() => onChallenge(u.id)}
                style={{
                  padding: '4px 8px', fontSize: '0.75rem',
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Challenge
              </button>
            )}
            {u.hasBot && u.id === currentUserId && (
              <button
                onClick={() => onChallenge(u.id)}
                style={{
                  padding: '4px 8px', fontSize: '0.75rem',
                  background: '#10b981', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Test Bot
              </button>
            )}
            {u.id === currentUserId && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(You)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
