const { tmdbFetch } = require("./tmdb");

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const query = String(req.query.query || "").trim();

        if (!query) {
            return res.status(400).json({
                success: false,
                error: "Search query is required"
            });
        }

        const page = Math.max(
            1,
            Number(req.query.page || 1)
        );

        const endpoint =
            `/search/multi?query=${encodeURIComponent(query)}` +
            `&page=${page}` +
            `&language=en-US` +
            `&include_adult=false`;

        const data = await tmdbFetch(endpoint);

        const results = (data.results || []).filter(
            item =>
                item.media_type === "movie" ||
                item.media_type === "tv"
        );

        return res.status(200).json({
            success: true,
            page: data.page,
            total_pages: data.total_pages,
            total_results: data.total_results,
            results
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
