const { tmdbFetch } = require("./tmdb");

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    try {
        const data = await tmdbFetch(
            "/trending/all/day?language=en-US"
        );

        return res.status(200).json({
            success: true,
            message: "Vercel → TMDB connection is working",
            results: data.results || []
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
