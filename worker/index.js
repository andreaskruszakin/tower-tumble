// Tower Tumble — Global Leaderboard API
// Cloudflare Worker + KV
// GET /scores → top 20 scores
// POST /scores → submit a score { name, points, floor, combo }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_SCORES = 50;     // store top 50
const KV_KEY = 'leaderboard';

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/scores' && request.method === 'GET') {
      return getScores(env);
    }

    if (url.pathname === '/scores' && request.method === 'POST') {
      return submitScore(request, env);
    }

    return new Response('Tower Tumble Leaderboard API', {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  },
};

async function getScores(env) {
  const data = await env.SCORES.get(KV_KEY, 'json');
  const scores = data || [];

  return new Response(JSON.stringify(scores.slice(0, 20)), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function submitScore(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { name, points, floor, combo } = body;

  // Validate
  if (!name || typeof name !== 'string' || name.length > 16) {
    return new Response(JSON.stringify({ error: 'Invalid name' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (typeof points !== 'number' || points < 0 || points > 999999) {
    return new Response(JSON.stringify({ error: 'Invalid points' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Sanitize name
  const cleanName = name.replace(/[<>&"']/g, '').trim().slice(0, 16);

  const entry = {
    name: cleanName,
    points: Math.floor(points),
    floor: Math.floor(floor || 0),
    combo: Math.floor(combo || 0),
    date: Date.now(),
  };

  // Get current scores, add new one, sort, trim
  const data = await env.SCORES.get(KV_KEY, 'json');
  const scores = data || [];
  scores.push(entry);
  scores.sort((a, b) => b.points - a.points);
  const trimmed = scores.slice(0, MAX_SCORES);

  await env.SCORES.put(KV_KEY, JSON.stringify(trimmed));

  // Find rank
  const rank = trimmed.findIndex(s => s.date === entry.date) + 1;

  return new Response(JSON.stringify({ rank, total: trimmed.length }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
