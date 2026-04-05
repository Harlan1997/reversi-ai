/**
 * Cloudflare Worker entry point.
 * Handles /api/* routes for KV operations.
 * Static assets (Next.js export) are served automatically via [assets] binding.
 */

import { handleUsers } from './api/users.js';
import { handleBot } from './api/bot.js';
import { handleElo } from './api/elo.js';
import { handleMatch } from './api/match.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // API routing
    if (path === '/api/users') return handleUsers(request, env);
    if (path === '/api/bot') return handleBot(request, env);
    if (path === '/api/elo') return handleElo(request, env);
    if (path === '/api/match') return handleMatch(request, env);

    // Everything else: let the assets binding serve static files
    return env.ASSETS.fetch(request);
  },
};
