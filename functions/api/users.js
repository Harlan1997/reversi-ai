/**
 * GET /api/users  — List all users sorted by Elo (descending), with hasBot flag.
 * POST /api/users — Register a new user. Body: { username }
 */
import { ensureSeeded, jsonResponse } from '../lib/seed.js';

export async function onRequestGet(context) {
  const kv = context.env.REVERSI_KV;
  const users = await ensureSeeded(kv);

  // Enrich with hasBot flag
  const enriched = await Promise.all(
    users.map(async (u) => {
      const bot = await kv.get(`bot:${u.id}`);
      return { ...u, hasBot: !!bot };
    })
  );
  enriched.sort((a, b) => b.elo - a.elo);

  return jsonResponse(enriched);
}

export async function onRequestPost(context) {
  const kv = context.env.REVERSI_KV;
  await ensureSeeded(kv);

  const body = await context.request.json();
  const { username } = body;
  if (!username || username.trim().length === 0) {
    return jsonResponse({ error: 'username is required' }, 400);
  }

  const users = JSON.parse(await kv.get('users')) || [];

  // Check duplicate
  if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return jsonResponse({ error: 'Username already taken' }, 409);
  }

  const newUser = {
    id: `u_${Date.now()}`,
    username: username.trim(),
    elo: 1000,
    isBot: false,
  };
  users.push(newUser);
  await kv.put('users', JSON.stringify(users));

  return jsonResponse(newUser, 201);
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
