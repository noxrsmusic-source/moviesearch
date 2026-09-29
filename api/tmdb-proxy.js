// api/tmdb-proxy.js

const TMDB_TOKEN = "9b7b483c93df65bd42c5e29ab1c8891a";

export default async function handler(req, res) {
    try {
        const endpoint = req.query.endpoint;

        if (!endpoint) {
            return res.status(400).json({
                error: "Missing endpoint"
            });
        }

        const response = await fetch(
            "https://api.themoviedb.org/3" + endpoint,
            {
                headers: {
                    "Authorization": `Bearer ${TMDB_TOKEN}`,
                    "accept": "application/json"
                }
            }
        );

        const data = await response.json();

        return res.status(response.status).json(data);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "TMDB request failed"
        });

    }
}
