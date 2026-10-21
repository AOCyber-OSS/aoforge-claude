'use strict';
/**
 * Minimal PNG reader and region diff for the test D fixture proofs (TRD 81-05). Pure node, no dependency.
 *
 * Reads what headless Chrome and the objective 74 captures contain: 8-bit, non-interlaced PNG of colour
 * type 0 (gray), 2 (RGB), 4 (gray+alpha) or 6 (RGBA). Anything else is refused with a clear error rather
 * than decoded wrongly.
 */

const zlib = require('node:zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/** Reverse the per-row PNG filters over the inflated stream; returns the pixel bytes. */
function unfilter(inflated, width, height, channels) {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filterType = inflated[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let i = 0; i < stride; i++) {
      const raw = inflated[src + i];
      const left = i >= channels ? out[row + i - channels] : 0;
      const up = y > 0 ? out[prev + i] : 0;
      const upLeft = y > 0 && i >= channels ? out[prev + i - channels] : 0;
      let value;
      switch (filterType) {
        case 0: value = raw; break;
        case 1: value = raw + left; break;
        case 2: value = raw + up; break;
        case 3: value = raw + ((left + up) >> 1); break;
        case 4: value = raw + paeth(left, up, upLeft); break;
        default: throw new Error(`PNG row ${y} has unknown filter type ${filterType}`);
      }
      out[row + i] = value & 0xff;
    }
  }
  return out;
}

/**
 * @param {Buffer} buffer a whole PNG file
 * @returns {{width: number, height: number, channels: number, data: Buffer}} row-major pixel bytes
 */
function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < SIGNATURE.length || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG (bad signature)');
  }
  let offset = SIGNATURE.length;
  let header = null;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const bodyStart = offset + 8;
    const bodyEnd = bodyStart + length;
    if (bodyEnd + 4 > buffer.length) throw new Error(`PNG chunk ${type} is truncated`);
    const crc = buffer.readUInt32BE(bodyEnd);
    if ((zlib.crc32(buffer.subarray(offset + 4, bodyEnd)) >>> 0) !== crc) {
      throw new Error(`PNG chunk ${type} fails its CRC`);
    }
    const body = buffer.subarray(bodyStart, bodyEnd);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset = bodyEnd + 4;
  }
  if (!header) throw new Error('not a PNG (no IHDR chunk)');
  if (header.interlace !== 0) throw new Error('interlaced PNG is not supported');
  if (header.bitDepth !== 8) {
    throw new Error(`unsupported bit depth ${header.bitDepth} (only 8-bit PNG is supported)`);
  }
  const channels = CHANNELS_BY_COLOR_TYPE[header.colorType];
  if (!channels) throw new Error(`unsupported colour type ${header.colorType} (supported: 0, 2, 4, 6)`);
  if (idat.length === 0) throw new Error('PNG has no IDAT chunk');

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const expected = header.height * (header.width * channels + 1);
  if (inflated.length !== expected) {
    throw new Error(`PNG pixel data is ${inflated.length} bytes, expected ${expected}`);
  }
  return {
    width: header.width,
    height: header.height,
    channels,
    data: unfilter(inflated, header.width, header.height, channels),
  };
}

/** The RGB of pixel index `p` (alpha ignored; gray is expanded). */
function rgbOffset(img, p) {
  const base = p * img.channels;
  return img.channels >= 3 ? [base, base + 1, base + 2] : [base, base, base];
}

function maxDelta(a, b, p) {
  const oa = rgbOffset(a, p);
  const ob = rgbOffset(b, p);
  let max = 0;
  for (let k = 0; k < 3; k++) {
    const d = Math.abs(a.data[oa[k]] - b.data[ob[k]]);
    if (d > max) max = d;
  }
  return max;
}

function assertSameSize(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

function assertRegion(img, region) {
  const { x, y, w, h } = region || {};
  const ok = [x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && w > 0 && h > 0 &&
    x + w <= img.width && y + h <= img.height;
  if (!ok) {
    throw new Error(`region ${JSON.stringify(region)} is empty or outside the ${img.width}x${img.height} image`);
  }
}

/**
 * Share of the pixels in `region` whose largest RGB channel delta between `a` and `b` exceeds `tol`.
 * 0 for identical images, 1 when every pixel of the region changed. Throws on a size mismatch.
 */
function regionDiffShare(a, b, region, tol = 24) {
  assertSameSize(a, b);
  assertRegion(a, region);
  let changed = 0;
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      if (maxDelta(a, b, y * a.width + x) > tol) changed++;
    }
  }
  return changed / (region.w * region.h);
}

/** Bounding box {x, y, w, h} of every pixel that differs by more than `tol`, or null when none does. */
function diffBounds(a, b, tol = 24) {
  assertSameSize(a, b);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (maxDelta(a, b, y * a.width + x) > tol) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

module.exports = { decodePng, regionDiffShare, diffBounds };
