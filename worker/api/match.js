import { ensureSeeded, json } from '../seed.js';

export async function handleMatch(request, env) {
  const kv = env.REVERSI_KV;
  await ensureSeeded(kv);

  if (request.method === 'GET') {
    const matchesRaw = await kv.get('matches');
    const matches = matchesRaw ? JSON.parse(matchesRaw) : [];
    return json(matches);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const matchesRaw = await kv.get('matches');
    const matches = matchesRaw ? JSON.parse(matchesRaw) : [];
    matches.push({ ...body, date: new Date().toISOString() });
    await kv.put('matches', JSON.stringify(matches));
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
