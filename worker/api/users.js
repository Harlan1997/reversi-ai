import { ensureSeeded, json } from '../seed.js';

export async function handleUsers(request, env) {
  const kv = env.REVERSI_KV;

  if (request.method === 'GET') {
    const users = await ensureSeeded(kv);
    const enriched = await Promise.all(
      users.map(async (u) => {
        const bot = await kv.get(`bot:${u.id}`);
        return { ...u, hasBot: !!bot };
      })
    );
    enriched.sort((a, b) => b.elo - a.elo);
    return json(enriched);
  }

  if (request.method === 'POST') {
    await ensureSeeded(kv);
    const body = await request.json();
    const { username } = body;
    if (!username || username.trim().length === 0) {
      return json({ error: 'username is required' }, 400);
    }
    const users = JSON.parse(await kv.get('users')) || [];
    if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return json({ error: 'Username already taken' }, 409);
    }
    const newUser = { id: `u_${Date.now()}`, username: username.trim(), elo: 1000, isBot: false };
    users.push(newUser);
    await kv.put('users', JSON.stringify(users));
    return json(newUser, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}
