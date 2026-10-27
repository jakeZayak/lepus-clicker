// Tiny static file server (ES modules need http://, not file://). Supports Range so the music can seek/loop.
// usage: node tools/serve.js [port]
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const port = Number(process.argv[2]) || 8642;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".json": "application/json", ".webmanifest": "application/manifest+json" };
http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(root, url === "/" ? "index.html" : url);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end("Not found");
      const headers = { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache", "Accept-Ranges": "bytes" };
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
      if (!range) return res.writeHead(200, headers).end(data);
      const start = range[1] ? Number(range[1]) : data.length - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}` }).end(data.subarray(start, end + 1));
    });
  })
  .listen(port, () => console.log(`Lepus Clicker: http://localhost:${port}`));
