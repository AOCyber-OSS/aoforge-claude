'use strict';
// TRD 81-05 Task 2: the PNG decoder and region diff the test D proofs use. Pure node, no dependency.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const { decodePng, regionDiffShare, diffBounds } = require('./png.cjs');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typeAndBody = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(typeAndBody) >>> 0);
  return Buffer.concat([len, typeAndBody, crc]);
}

function ihdr(width, height, bitDepth, colorType, interlace) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width, 0);
  b.writeUInt32BE(height, 4);
  b[8] = bitDepth;
  b[9] = colorType;
  b[10] = 0; // compression
  b[11] = 0; // filter method
  b[12] = interlace;
  return b;
}

/** Build a PNG from already-filtered scanlines (each row starts with its filter byte). */
function pngFromFilteredRows(width, height, bitDepth, colorType, interlace, rows) {
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr(width, height, bitDepth, colorType, interlace)),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 2x2 RGBA pixels, row-major: red, green / blue, translucent white.
const PIXELS = [
  [255, 0, 0, 255], [0, 255, 0, 255],
  [0, 0, 255, 255], [255, 255, 255, 128],
];
const RAW_ROWS = [
  Buffer.from([...PIXELS[0], ...PIXELS[1]]),
  Buffer.from([...PIXELS[2], ...PIXELS[3]]),
];
const BPP = 4;

function filterRow(type, row, prev) {
  const out = Buffer.alloc(row.length + 1);
  out[0] = type;
  for (let i = 0; i < row.length; i++) {
    const left = i >= BPP ? row[i - BPP] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= BPP ? prev[i - BPP] : 0;
    let predicted = 0;
    if (type === 1) predicted = left;
    else if (type === 2) predicted = up;
    else if (type === 3) predicted = Math.floor((left + up) / 2);
    else if (type === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
    }
    out[i + 1] = (row[i] - predicted) & 0xff;
  }
  return out;
}

function rgbaImage(width, height, fill) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set(typeof fill === 'function' ? fill(i % width, Math.floor(i / width)) : fill, i * 4);
  }
  return { width, height, channels: 4, data };
}

// 1. decodePng ---------------------------------------------------------------------------------

test('decodePng reads a hand-built 2x2 RGBA PNG (filter 0) to the exact pixels', () => {
  const png = pngFromFilteredRows(2, 2, 8, 6, 0, RAW_ROWS.map((r) => Buffer.concat([Buffer.from([0]), r])));
  const img = decodePng(png);
  assert.equal(img.width, 2);
  assert.equal(img.height, 2);
  assert.equal(img.channels, 4);
  assert.deepEqual([...img.data], PIXELS.flat());
});

for (const [type, name] of [[1, 'Sub'], [2, 'Up'], [3, 'Average'], [4, 'Paeth']]) {
  test(`decodePng unfilters ${name} (filter ${type}) rows to the same pixels`, () => {
    const rows = [filterRow(type, RAW_ROWS[0], null), filterRow(type, RAW_ROWS[1], RAW_ROWS[0])];
    const img = decodePng(pngFromFilteredRows(2, 2, 8, 6, 0, rows));
    assert.deepEqual([...img.data], PIXELS.flat());
  });
}

test('decodePng reads an RGB (colour type 2) PNG with mixed filters across rows', () => {
  const rgb = [Buffer.from([10, 20, 30, 40, 50, 60]), Buffer.from([70, 80, 90, 100, 110, 120])];
  // Sub on row 0 (bpp 3), Up on row 1.
  const row0 = Buffer.from([1, 10, 20, 30, 30, 30, 30]);
  const row1 = Buffer.concat([Buffer.from([2]), Buffer.from(rgb[1].map((v, i) => (v - rgb[0][i]) & 0xff))]);
  const img = decodePng(pngFromFilteredRows(2, 2, 8, 2, 0, [row0, row1]));
  assert.equal(img.channels, 3);
  assert.deepEqual([...img.data], [...rgb[0], ...rgb[1]]);
});

test('decodePng reads a grayscale (colour type 0) PNG', () => {
  const rows = [Buffer.from([0, 0, 255]), Buffer.from([0, 128, 64])];
  const img = decodePng(pngFromFilteredRows(2, 2, 8, 0, 0, rows));
  assert.equal(img.channels, 1);
  assert.deepEqual([...img.data], [0, 255, 128, 64]);
});

test('decodePng joins pixel data split across several IDAT chunks', () => {
  const deflated = zlib.deflateSync(Buffer.concat(RAW_ROWS.map((r) => Buffer.concat([Buffer.from([0]), r]))));
  const mid = Math.floor(deflated.length / 2);
  const png = Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr(2, 2, 8, 6, 0)),
    chunk('IDAT', deflated.subarray(0, mid)),
    chunk('IDAT', deflated.subarray(mid)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  assert.deepEqual([...decodePng(png).data], PIXELS.flat());
});

// 2. unsupported variants ---------------------------------------------------------------------

test('decodePng rejects an interlaced PNG with a clear error', () => {
  const png = pngFromFilteredRows(2, 2, 8, 6, 1, RAW_ROWS.map((r) => Buffer.concat([Buffer.from([0]), r])));
  assert.throws(() => decodePng(png), /interlaced/i);
});

test('decodePng rejects a 16-bit PNG with a clear error', () => {
  const row = Buffer.alloc(1 + 2 * 4 * 2);
  const png = pngFromFilteredRows(2, 1, 16, 6, 0, [row]);
  assert.throws(() => decodePng(png), /16-bit|bit depth/i);
});

test('decodePng rejects data that is not a PNG', () => {
  assert.throws(() => decodePng(Buffer.from('not a png at all')), /not a PNG/i);
});

test('decodePng rejects an unsupported colour type (palette)', () => {
  const png = pngFromFilteredRows(2, 1, 8, 3, 0, [Buffer.from([0, 0, 1])]);
  assert.throws(() => decodePng(png), /colou?r type 3/i);
});

// 3. regionDiffShare --------------------------------------------------------------------------

test('regionDiffShare is 0 for identical images and 1 when the region is fully changed', () => {
  const a = rgbaImage(10, 10, [10, 10, 10, 255]);
  const same = rgbaImage(10, 10, [10, 10, 10, 255]);
  const changed = rgbaImage(10, 10, [200, 10, 10, 255]);
  const region = { x: 2, y: 3, w: 4, h: 5 };
  assert.equal(regionDiffShare(a, same, region), 0);
  assert.equal(regionDiffShare(a, changed, region), 1);
});

test('regionDiffShare counts only pixels inside the region whose max channel delta exceeds tol', () => {
  const a = rgbaImage(10, 10, [0, 0, 0, 255]);
  // 4 changed pixels inside the 4x4 region (x 2..5, y 2..5), 1 changed pixel outside it.
  const b = rgbaImage(10, 10, (x, y) => {
    if ((x === 2 && y === 2) || (x === 3 && y === 2) || (x === 4 && y === 4) || (x === 5 && y === 5)) return [0, 0, 100, 255];
    if (x === 9 && y === 9) return [255, 255, 255, 255];
    return [0, 0, 0, 255];
  });
  assert.equal(regionDiffShare(a, b, { x: 2, y: 2, w: 4, h: 4 }), 4 / 16);
  assert.equal(regionDiffShare(a, b, { x: 0, y: 0, w: 10, h: 10 }), 5 / 100);
});

test('regionDiffShare uses a strict tolerance: a delta equal to tol is not a change', () => {
  const a = rgbaImage(2, 2, [100, 100, 100, 255]);
  const edge = rgbaImage(2, 2, [124, 100, 100, 255]);
  const over = rgbaImage(2, 2, [125, 100, 100, 255]);
  const whole = { x: 0, y: 0, w: 2, h: 2 };
  assert.equal(regionDiffShare(a, edge, whole), 0);
  assert.equal(regionDiffShare(a, over, whole), 1);
  assert.equal(regionDiffShare(a, edge, whole, 10), 1);
});

test('regionDiffShare ignores the alpha channel and compares RGB only', () => {
  const a = rgbaImage(2, 2, [50, 50, 50, 255]);
  const b = rgbaImage(2, 2, [50, 50, 50, 0]);
  assert.equal(regionDiffShare(a, b, { x: 0, y: 0, w: 2, h: 2 }), 0);
});

test('regionDiffShare compares an RGB image with an RGBA image of the same size', () => {
  const rgba = rgbaImage(2, 1, [10, 20, 30, 255]);
  const rgb = { width: 2, height: 1, channels: 3, data: Buffer.from([10, 20, 30, 200, 20, 30]) };
  assert.equal(regionDiffShare(rgba, rgb, { x: 0, y: 0, w: 2, h: 1 }), 0.5);
});

test('regionDiffShare throws on a size mismatch and on a region outside the image', () => {
  const a = rgbaImage(4, 4, [0, 0, 0, 255]);
  const b = rgbaImage(5, 4, [0, 0, 0, 255]);
  assert.throws(() => regionDiffShare(a, b, { x: 0, y: 0, w: 4, h: 4 }), /size mismatch/i);
  assert.throws(() => regionDiffShare(a, a, { x: 2, y: 2, w: 5, h: 1 }), /region/i);
  assert.throws(() => regionDiffShare(a, a, { x: 0, y: 0, w: 0, h: 1 }), /region/i);
});

// diffBounds: the helper used to measure a declared region on a real capture -------------------

test('diffBounds returns the bounding box of changed pixels, or null when nothing changed', () => {
  const a = rgbaImage(10, 10, [0, 0, 0, 255]);
  const b = rgbaImage(10, 10, (x, y) => (x >= 3 && x <= 6 && y >= 4 && y <= 8 && (x + y) % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  assert.deepEqual(diffBounds(a, b), { x: 3, y: 4, w: 4, h: 5 });
  assert.equal(diffBounds(a, a), null);
});
