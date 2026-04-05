import { ensureSeeded, json } from '../seed.js';

export async function handleBot(request, env) {
  const kv = env.REVERSI_KV;
  await ensureSeeded(kv);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return json({ error: 'userId query param required' }, 400);
    const botRaw = await kv.get(`bot:${userId}`);
    return json(botRaw ? JSON.parse(botRaw) : null);
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const { userId, code } = body;
    if (!userId || typeof code !== 'string') return json({ error: 'userId and code required' }, 400);
    const users = JSON.parse(await kv.get('users')) || [];
    if (!users.find(u => u.id === userId)) return json({ error: 'User not found' }, 404);
    const existing = await kv.get(`bot:${userId}`);
    let bot;
    if (existing) {
      bot = JSON.parse(existing);
      bot.code = code;
    } else {
      bot = { id: `bot_${Date.now()}`, userId, name: 'Custom Bot', code };
    }
    await kv.put(`bot:${userId}`, JSON.stringify(bot));
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
