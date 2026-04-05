/**
 * PUT /api/elo — Update a user's Elo rating. Body: { userId, newElo }
 */
import { ensureSeeded, jsonResponse } from '../lib/seed.js';

export async function onRequestPut(context) {
  const kv = context.env.REVERSI_KV;
  await ensureSeeded(kv);

  const body = await context.request.json();
  const { userId, newElo } = body;
  if (!userId || typeof newElo !== 'number') {
    return jsonResponse({ error: 'userId and newElo are required' }, 400);
  }

  const users = JSON.parse(await kv.get('users')) || [];
  const user = users.find(u => u.id === userId);
  if (!user) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  user.elo = newElo;
  await kv.put('users', JSON.stringify(users));

  return jsonResponse({ success: true, elo: newElo });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
