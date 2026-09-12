import { deflateSync } from 'node:zlib';

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Build a real (decodable) RGBA PNG in memory for use as an upload fixture, so
 * the repo carries no binary test assets.
 *
 * @param {number} width
 * @param {number} height
 * @param {[number,number,number]} rgb
 * @returns {Buffer}
 */
export function makePng(width = 64, height = 48, rgb = [124, 82, 51]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 4;
      // A visible diagonal stripe so the thumbnail is obviously not a flat fill.
      const stripe = (x + y) % 16 < 8;
      raw[i] = stripe ? rgb[0] : 122;
      raw[i + 1] = stripe ? rgb[1] : 201;
      raw[i + 2] = stripe ? rgb[2] : 129;
      raw[i + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A Playwright `setInputFiles` payload for a generated PNG. */
export function photoFixture(name = 'fallen-tree.png') {
  return { name, mimeType: 'image/png', buffer: makePng() };
}

export const HALIFAX = { latitude: 44.6488, longitude: -63.5752, accuracy: 12 };
