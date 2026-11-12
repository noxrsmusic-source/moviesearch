export default async function handler(req, res) {
    // CORS allow
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        // Rewrite rule se aane wala targetPath nikaalein
        let targetPath = req.query.targetPath || '';
        
        // Vercel URL encode karta hai, toh decode karein
        targetPath = decodeURIComponent(targetPath);

        // Asli URL banayein
        const targetUrl = `https://nxsha.space/embed${targetPath}`;

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://nxsha.space/',
                'Origin': 'https://nxsha.space'
            }
        });

        // Headers copy karein
        for (const [key, value] of response.headers.entries()) {
            const k = key.toLowerCase();
            if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-frame-options', 'content-security-policy'].includes(k)) {
                res.setHeader(key, value);
            }
        }

        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).send("Proxy Error: " + error.message);
    }
}
