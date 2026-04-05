import { ensureSeeded, json } from '../seed.js';

export async function handleElo(request, env) {
  const kv = env.REVERSI_KV;
  await ensureSeeded(kv);

  if (request.method === 'PUT') {
    const body = await request.json();
    const { userId, newElo } = body;
    if (!userId || typeof newElo !== 'number') return json({ error: 'userId and newElo required' }, 400);
    const users = JSON.parse(await kv.get('users')) || [];
    const user = users.find(u => u.id === userId);
    if (!user) return json({ error: 'User not found' }, 404);
    user.elo = newElo;
    await kv.put('users', JSON.stringify(users));
    return json({ success: true, elo: newElo });
  }

  return json({ error: 'Method not allowed' }, 405);
}
