// api/details.js

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

        const id =
            String(req.query.id || "").trim();

        const type =
            String(req.query.type || "movie").trim();

        if (!id) {

            return res.status(400).json({
                success: false,
                error: "Movie or TV ID is required."
            });

        }

        if (
            type !== "movie" &&
            type !== "tv"
        ) {

            return res.status(400).json({
                success: false,
                error: "Invalid media type."
            });

        }

        const endpoint =
            `https://api.themoviedb.org/3/${type}/${encodeURIComponent(id)}`;

        const url =
            new URL(endpoint);

        url.searchParams.set(
            "api_key",
            TMDB_API_KEY
        );

        url.searchParams.set(
            "language",
            "en-US"
        );

        // Get details, cast, trailer and similar content
        url.searchParams.set(
            "append_to_response",
            "credits,videos,similar,recommendations"
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
                    "Unable to load details."
            });

        }

        return res.status(200).json({

            details: data,

            cast:
                data.credits?.cast ||
                [],

            videos:
                data.videos?.results ||
                [],

            similar:
                data.similar?.results ||
                [],

            recommendations:
                data.recommendations?.results ||
                []

        });

    } catch (error) {

        console.error(
            "Details Error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Details request failed."
        });

    }

}
