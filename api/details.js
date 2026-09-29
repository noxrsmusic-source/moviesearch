const { tmdbFetch } = require("./tmdb");

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const type = req.query.type;
        const id = req.query.id;

        if (!["movie", "tv"].includes(type)) {
            return res.status(400).json({
                success: false,
                error: "Type must be movie or tv"
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                error: "ID is required"
            });
        }

        const encodedId = encodeURIComponent(id);

        const details = await tmdbFetch(
            `/${type}/${encodedId}?language=en-US`
        );

        const credits = await tmdbFetch(
            `/${type}/${encodedId}/credits?language=en-US`
        );

        const videos = await tmdbFetch(
            `/${type}/${encodedId}/videos?language=en-US`
        );

        const similar = await tmdbFetch(
            `/${type}/${encodedId}/similar?language=en-US&page=1`
        );

        return res.status(200).json({
            success: true,
            details,
            cast: credits.cast || [],
            crew: credits.crew || [],
            videos: videos.results || [],
            similar: similar.results || []
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
