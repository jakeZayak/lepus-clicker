// Convert uncompressed XNA SoundEffect .xnb files to .wav.
// usage: node extract_xnb_sound.js <outDir> <in.xnb>[=outName] ...
const fs = require("fs"), path = require("path");
const [outDir, ...inputs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
for (const arg of inputs) {
  const [src, name] = arg.split("=");
  const b = fs.readFileSync(src);
  if (b.toString("latin1", 0, 3) !== "XNB" || b[5] & 0xc0) throw new Error(src + ": not an uncompressed XNB");
  let p = 10;
  const varint = () => { let n = 0, s = 0, c; do { c = b[p++]; n |= (c & 127) << s; s += 7; } while (c & 128); return n; };
  for (let r = varint(); r > 0; r--) { const len = varint(); p += len + 4; }
  varint(); varint();
  const fmtSize = b.readInt32LE(p); const fmt = b.subarray(p + 4, p + 4 + fmtSize); p += 4 + fmtSize;
  const dataSize = b.readInt32LE(p); const data = b.subarray(p + 4, p + 4 + dataSize);
  if (fmt.readUInt16LE(0) !== 1) throw new Error(src + ": not PCM");
  const hdr = Buffer.alloc(20); hdr.write("RIFF"); hdr.writeUInt32LE(4 + 8 + fmtSize + 8 + dataSize, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(fmtSize, 16);
  const dh = Buffer.alloc(8); dh.write("data"); dh.writeUInt32LE(dataSize, 4);
  const out = path.join(outDir, (name || path.basename(src, ".xnb")) + ".wav");
  fs.writeFileSync(out, Buffer.concat([hdr, fmt, dh, data]));
  console.log(out, fmt.readUInt16LE(2) + "ch", fmt.readUInt32LE(4) + "Hz", (dataSize / fmt.readUInt32LE(8)).toFixed(2) + "s");
}
