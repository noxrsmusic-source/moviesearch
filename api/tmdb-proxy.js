

// api/tmdb-proxy.js

const TMDB_API_KEY = "9b7b483c93df65bd42c5e29ab1c8891a";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Only these TMDB API areas are allowed through this proxy.
// This prevents the endpoint from becoming a completely open proxy.
const ALLOWED_PREFIXES = [
    "/trending/",
    "/movie/",
    "/tv/",
    "/discover/",
    "/search/",
    "/genre/",
    "/configuration/"
];

export default async function handler(req, res) {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Only GET requests are allowed."
        });
    }

    try {

        if (
            !TMDB_API_KEY ||
            TMDB_API_KEY === "PASTE_YOUR_TMDB_API_KEY_HERE"
        ) {

            return res.status(500).json({
                success: false,
                error: "TMDB API key is not configured."
            });

        }

        let endpoint = req.query.endpoint;

        if (!endpoint) {

            return res.status(400).json({
                success: false,
                error: "Missing endpoint."
            });

        }

        endpoint = String(endpoint);

        // Must start with /
        if (!endpoint.startsWith("/")) {

            return res.status(400).json({
                success: false,
                error: "Invalid endpoint."
            });

        }

        // Prevent external URLs
        if (
            endpoint.includes("://") ||
            endpoint.startsWith("//")
        ) {

            return res.status(400).json({
                success: false,
                error: "Invalid endpoint."
            });

        }

        // Check allowed TMDB endpoints
        const allowed =
            ALLOWED_PREFIXES.some(
                prefix => endpoint.startsWith(prefix)
            );

        if (!allowed) {

            return res.status(403).json({
                success: false,
                error: "This TMDB endpoint is not allowed."
            });

        }

        /*
         * Build TMDB URL.
         *
         * Example:
         * /movie/popular?language=en-US&page=1
         *
         * becomes:
         * https://api.themoviedb.org/3/movie/popular?language=en-US&page=1&api_key=...
         */

        const tmdbURL =
            new URL(
                TMDB_BASE_URL + endpoint
            );

        // Always use the server-side API key.
        tmdbURL.searchParams.set(
            "api_key",
            TMDB_API_KEY
        );

        const response =
            await fetch(
                tmdbURL.toString(),
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const text =
            await response.text();

        let data;

        try {

            data =
                JSON.parse(text);

        } catch {

            return res.status(502).json({
                success: false,
                error: "TMDB returned an invalid response."
            });

        }

        if (!response.ok) {

            return res.status(response.status).json({
                success: false,
                error:
                    data.status_message ||
                    "TMDB request failed.",
                tmdb_status_code:
                    data.status_code || response.status
            });

        }

        return res.status(200).json(data);

    } catch (error) {

        console.error(
            "TMDB Proxy Error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to connect to TMDB.",
            message:
                error.message
        });

    }

}
