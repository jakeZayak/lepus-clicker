// Extract entries from a .tmod archive. rawimg entries are converted to PNG.
// usage: node extract_tmod.js <file.tmod> <outDir> <regex>
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { encodePNG } = require("./png");
const [file, outDir, pattern] = process.argv.slice(2);
const b = fs.readFileSync(file);
let p = 4;
function str() { let n = 0, s = 0, c; do { c = b[p++]; n |= (c & 127) << s; s += 7; } while (c & 128); const t = b.toString("utf8", p, p + n); p += n; return t; }
str(); p += 20 + 256 + 4; str(); str();
const count = b.readInt32LE(p); p += 4;
const entries = [];
for (let i = 0; i < count; i++) { const name = str(); entries.push({ name, len: b.readInt32LE(p), clen: b.readInt32LE(p + 4) }); p += 8; }
const re = new RegExp(pattern, "i");
for (const e of entries) {
  const start = p; p += e.clen;
  if (!re.test(e.name)) continue;
  let data = b.subarray(start, start + e.clen);
  if (e.clen !== e.len) data = zlib.inflateRawSync(data);
  let out = path.join(outDir, e.name);
  if (e.name.endsWith(".rawimg")) {
    const w = data.readInt32LE(4), h = data.readInt32LE(8);
    data = encodePNG(w, h, data.subarray(12));
    out = out.replace(/\.rawimg$/, ".png");
    console.log(e.name, `${w}x${h}`);
  } else console.log(e.name, data.length);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
}
