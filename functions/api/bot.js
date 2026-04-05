/**
 * GET  /api/bot?userId=X  — Get a user's bot code.
 * PUT  /api/bot           — Save a user's bot code. Body: { userId, code }
 */
import { ensureSeeded, jsonResponse } from '../lib/seed.js';

export async function onRequestGet(context) {
  const kv = context.env.REVERSI_KV;
  await ensureSeeded(kv);

  const url = new URL(context.request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return jsonResponse({ error: 'userId query param required' }, 400);
  }

  const botRaw = await kv.get(`bot:${userId}`);
  if (!botRaw) {
    return jsonResponse(null);
  }
  return jsonResponse(JSON.parse(botRaw));
}

export async function onRequestPut(context) {
  const kv = context.env.REVERSI_KV;
  await ensureSeeded(kv);

  const body = await context.request.json();
  const { userId, code } = body;
  if (!userId || typeof code !== 'string') {
    return jsonResponse({ error: 'userId and code are required' }, 400);
  }

  // Ensure user exists
  const users = JSON.parse(await kv.get('users')) || [];
  if (!users.find(u => u.id === userId)) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  const existing = await kv.get(`bot:${userId}`);
  let bot;
  if (existing) {
    bot = JSON.parse(existing);
    bot.code = code;
  } else {
    bot = { id: `bot_${Date.now()}`, userId, name: 'Custom Bot', code };
    // Mark user as having a bot in users list
    const user = users.find(u => u.id === userId);
    if (user) user.hasBot = true;
    await kv.put('users', JSON.stringify(users));
  }
  await kv.put(`bot:${userId}`, JSON.stringify(bot));

  return jsonResponse({ success: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
