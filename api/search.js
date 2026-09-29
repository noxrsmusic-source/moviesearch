// api/search.js

const TMDB_API_KEY = "9b7b483c93df65bd42c5e29ab1c8891a";

export default async function handler(req, res) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    if (req.method !== "GET") {

        return res.status(405).json({
            success: false,
            error: "Only GET requests are allowed."
        });

    }

    try {

        const query =
            String(req.query.query || "").trim();

        if (!query) {

            return res.status(400).json({
                success: false,
                error: "Search query is required."
            });

        }

        const url =
            new URL(
                "https://api.themoviedb.org/3/search/multi"
            );

        url.searchParams.set(
            "api_key",
            TMDB_API_KEY
        );

        url.searchParams.set(
            "query",
            query
        );

        url.searchParams.set(
            "language",
            "en-US"
        );

        url.searchParams.set(
            "page",
            "1"
        );

        url.searchParams.set(
            "include_adult",
            "false"
        );

        const response =
            await fetch(
                url.toString()
            );

        const data =
            await response.json();

        if (!response.ok) {

            return res.status(response.status).json({
                success: false,
                error:
                    data.status_message ||
                    "TMDB search failed."
            });

        }

        // Only movies and TV shows
        const filtered =
            (data.results || [])
            .filter(
                item =>
                    item.media_type === "movie" ||
                    item.media_type === "tv"
            );

        return res.status(200).json({
            page: data.page,
            total_pages: data.total_pages,
            total_results: data.total_results,
            results: filtered
        });

    } catch (error) {

        console.error(
            "Search Error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Search request failed."
        });

    }

}
