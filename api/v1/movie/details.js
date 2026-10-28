import { cors } from '../../_cors.js';
import { requireKey } from '../../_auth.js';

export default async function handler(req, res) {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Only GET requests are allowed." });
    }

    try {
        // 1. API Key Check
        const auth = await requireKey(req);

        const id = String(req.query.id || "").trim();
        // Type ko lower case karein taaki 'TV' ya 'Tv' bhi chal jaye
        const type = String(req.query.type || "movie").trim().toLowerCase(); 

        if (!id) {
            return res.status(400).json({ success: false, error: "Movie or TV ID is required." });
        }

        if (type !== "movie" && type !== "tv") {
            return res.status(400).json({ success: false, error: "Invalid media type. Use 'movie' or 'tv'." });
        }

        const endpoint = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(id)}`;
        const url = new URL(endpoint);

        // Yahan process.env.TMDB_KEY use kiya hai
        url.searchParams.set("api_key", process.env.TMDB_KEY);
        url.searchParams.set("language", "en-US");
        url.searchParams.set("append_to_response", "credits,videos,similar,recommendations,external_ids");

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data.status_message || "Unable to load details." });
        }

        // 2. Embed URL Generate karein (Movies vs Series/Anime)
        let embedUrl = `https://rxplayer-indol.vercel.app/embed-movie.html?id=${id}&type=${type}`;
        
        // Agar TV/Series/Anime hai, toh default Season 1, Episode 1 add karein
        if (type === 'tv') {
            embedUrl += `&season=1&episode=1`;
        }

        return res.status(200).json({
            success: true,
            data: {
                id: data.id,
                title: data.title || data.name, // TV shows have 'name', movies have 'title'
                year: (data.release_date || data.first_air_date || '').slice(0, 4),
                rating: data.vote_average,
                poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
                overview: data.overview,
                type: type,
                embed_url: embedUrl,
                iframe_html: `<iframe src="${embedUrl}" width="800" height="450" frameborder="0" allowfullscreen></iframe>`,
                // Raw TMDB Data
                details: data,
                cast: data.credits?.cast || [],
                videos: data.videos?.results || [],
                similar: data.similar?.results || [],
                recommendations: data.recommendations?.results || []
            },
            quota: { used: auth.used, limit: auth.limit }
        });

    } catch (error) {
        console.error("Details Error:", error);
        return res.status(error.status || 500).json({ success: false, error: error.message || "Details request failed." });
    }
}
