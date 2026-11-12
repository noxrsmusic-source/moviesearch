export default async function handler(req, res) {
    // CORS allow karein
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        // Request URL se /api/proxy hata kar asli path banayein
        // Example: /api/proxy/tv/303044/1/1 -> /tv/303044/1/1
        const targetPath = req.url.replace('/api/proxy', '');
        const targetUrl = `https://nxsha.space/embed${targetPath}`;

        // Asli server se data fetch karein
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://nxsha.space/',
                'Origin': 'https://nxsha.space'
            }
        });

        // Headers ko copy karein, lekin security wale headers ko hata dein
        for (const [key, value] of response.headers.entries()) {
            const k = key.toLowerCase();
            // In headers ko block karna zaroori hai warna iframe block ho jayega
            if (['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-frame-options', 'content-security-policy', 'content-security-policy-report-only'].includes(k)) {
                continue;
            }
            res.setHeader(key, value);
        }

        // HTML/Data ko fetch karke user ko bhej dein
        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ success: false, error: "Proxy failed to load the stream." });
    }
}
