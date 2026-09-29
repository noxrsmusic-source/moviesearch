// api/test-tmdb.js

const TMDB_API_KEY = "9b7b483c93df65bd42c5e29ab1c8891a";

export default async function handler(req, res) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    try {

        const url =
            new URL(
                "https://api.themoviedb.org/3/trending/all/day"
            );

        url.searchParams.set(
            "api_key",
            TMDB_API_KEY
        );

        url.searchParams.set(
            "language",
            "en-US"
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
                    "TMDB connection failed."
            });

        }

        return res.status(200).json(data);

    } catch (error) {

        console.error(
            "TMDB Test Error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Vercel could not connect to TMDB.",
            message:
                error.message
        });

    }

}
