import { cors } from '../../_cors.js';
import { requireKey } from '../../_auth.js';

export default async function handler(req,res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let auth;
  try { auth = await requireKey(req); }
  catch(e){ return res.status(e.status||500).json({ success:false, error:e.message }); }

  const q = req.query.q || req.query.query || '';
  if (!q) return res.status(400).json({ success:false, error:'q required' });

  const r = await fetch(`https://music-psi-sand.vercel.app/api/search?query=${encodeURIComponent(q)}`);
  const j = await r.json();
  const raw = Array.isArray(j) ? j : (j.results || j.data || []);

  const tracks = raw.slice(0,20).map(t => ({
    id: t.id,
    title: t.title || t.name,
    artist: t.artist || t.singers || 'Unknown',
    cover: t.cover || t.image || null,
    stream_url: t.audioUrl || t.url || null,
    embed_url: `https://rxplayer.com/embed-music.html?id=${encodeURIComponent(t.id)}`
  }));

  res.json({ success:true, data:tracks, quota:{ used:auth.used, limit:auth.limit } });
}
