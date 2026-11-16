// Minimal ZIP-skrivare (utan komprimering, "stored"). Ingen extern kod.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {Array<{path:string, content:string|Uint8Array}>} files
 * @returns {Uint8Array}
 */
export function createZip(files, now = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(now.getFullYear() - 1980, 0) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const entries = files.map((f) => {
    const name = enc.encode(f.path);
    const data = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
    return { name, data, crc: crc32(data) };
  });

  let size = 22;
  for (const e of entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let p = 0;
  const u16 = (v) => { dv.setUint16(p, v, true); p += 2; };
  const u32 = (v) => { dv.setUint32(p, v, true); p += 4; };

  for (const e of entries) {
    e.offset = p;
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(dosTime); u16(dosDate);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
    out.set(e.name, p); p += e.name.length;
    out.set(e.data, p); p += e.data.length;
  }
  const cdStart = p;
  for (const e of entries) {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(dosTime); u16(dosDate);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length);
    u16(0); u16(0); u16(0); u16(0); u32(0); u32(e.offset);
    out.set(e.name, p); p += e.name.length;
  }
  const cdSize = p - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(cdSize); u32(cdStart); u16(0);
  return out;
}
