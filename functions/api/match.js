/**
 * POST /api/match — Record a match result. Body: { playerId, opponentId, scoreMe, myElo, opElo }
 */
import { ensureSeeded, jsonResponse } from '../lib/seed.js';

export async function onRequestPost(context) {
  const kv = context.env.REVERSI_KV;
  await ensureSeeded(kv);

  const body = await context.request.json();
  const matchesRaw = await kv.get('matches');
  const matches = matchesRaw ? JSON.parse(matchesRaw) : [];

  matches.push({ ...body, date: new Date().toISOString() });
  await kv.put('matches', JSON.stringify(matches));

  return jsonResponse({ success: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
