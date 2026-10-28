import { cors } from '../../_cors.js';
import { requireKey } from '../../_auth.js';

export default async function handler(req,res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let auth;
  try { auth = await requireKey(req); }
  catch(e){ return res.status(e.status||500).json({ success:false, error:e.message }); }

  const { id, type='movie' } = req.query;
  if (!id) return res.status(400).json({ success:false, error:'id required' });

  const r = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_KEY}`);
  if (!r.ok) return res.status(404).json({ success:false, error:'Not found' });
  const d = await r.json();

  const embedUrl = `https://rxplayer.com/embed-movie.html?id=${id}&type=${type}`;

  res.json({
    success:true,
    data:{
      id:d.id,
      title:d.title||d.name,
      year:(d.release_date||d.first_air_date||'').slice(0,4),
      rating:d.vote_average,
      poster:d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      overview:d.overview,
      embed_url: embedUrl,
      iframe_html: `<iframe src="${embedUrl}" width="800" height="450" frameborder="0" allowfullscreen></iframe>`
    },
    quota:{ used:auth.used, limit:auth.limit }
  });
}
