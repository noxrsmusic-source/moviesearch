const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbFetch(endpoint) {
    const token = process.env.TMDB_TOKEN;

    if (!token) {
        throw new Error("TMDB_TOKEN is not configured");
    }

    const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`
        }
    });

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("TMDB returned an invalid response");
    }

    if (!response.ok) {
        throw new Error(
            data.status_message ||
            `TMDB request failed with status ${response.status}`
        );
    }

    return data;
}

module.exports = {
    tmdbFetch
};
