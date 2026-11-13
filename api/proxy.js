export default async function handler(req, res) {
    // CORS allow
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // URL se path nikaalein (e.g. /tv/312359/1/1)
    const targetPath = req.url.replace('/api/stream', '');
    const targetUrl = `https://nxsha.space/embed${targetPath}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Asli site ko dhoka dene ke liye headers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://nxsha.space/',
                'Origin': 'https://nxsha.space'
            }
        });

        // Response headers ko copy karein (lekin kuch security headers ko remove karein)
        for (const [key, value] of response.headers.entries()) {
            const k = key.toLowerCase();
            // In headers ko block karein warna iframe nahi chalega
            if (['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-frame-options', 'content-security-policy'].includes(k)) {
                continue;
            }
            res.setHeader(key, value);
        }

        // Data ko stream karke user ko bhejein
        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));
        
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).send("Proxy error");
    }
}
