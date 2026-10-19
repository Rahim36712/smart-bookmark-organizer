const fs = require('fs');
const zlib = require('zlib');

// Create PNG buffer without external dependencies using pure Node.js zlib
function createPng(width, height, drawFn) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = drawFn(x, y, width, height);
      rgba[idx] = color.r;
      rgba[idx + 1] = color.g;
      rgba[idx + 2] = color.b;
      rgba[idx + 3] = color.a;
    }
  }

  // PNG filter byte 0 (None) at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0; // Filter: None
    rgba.copy(rawData, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcTarget = chunk.subarray(4, 8 + length);
  const crc = calculateCrc(crcTarget);
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calculateCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Draw modern bookmark organizer emblem
function drawIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.hypot(nx - cx, ny - cy);

  // Rounded rectangle container
  const pad = 0.08;
  const rad = 0.22;
  const inBox = (nx >= pad && nx <= 1 - pad && ny >= pad && ny <= 1 - pad);

  // Corner rounding
  let inCorner = false;
  if (nx < pad + rad && ny < pad + rad) inCorner = Math.hypot(nx - (pad + rad), ny - (pad + rad)) > rad;
  if (nx > 1 - pad - rad && ny < pad + rad) inCorner = Math.hypot(nx - (1 - pad - rad), ny - (pad + rad)) > rad;
  if (nx < pad + rad && ny > 1 - pad - rad) inCorner = Math.hypot(nx - (pad + rad), ny - (1 - pad - rad)) > rad;
  if (nx > 1 - pad - rad && ny > 1 - pad - rad) inCorner = Math.hypot(nx - (1 - pad - rad), ny - (1 - pad - rad)) > rad;

  if (!inBox || inCorner) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Background Gradient (Deep Indigo to Vibrant Violet)
  let r = Math.round(58 + (nx * 30));
  let g = Math.round(50 + (ny * 40));
  let b = Math.round(230 - (nx * 40));

  // Draw bookmark ribbon motif in white/cyan
  const bmLeft = 0.32;
  const bmRight = 0.68;
  const bmTop = 0.22;
  const bmBottom = 0.78;

  if (nx >= bmLeft && nx <= bmRight && ny >= bmTop && ny <= bmBottom) {
    // Notch at the bottom of bookmark ribbon
    const notchH = 0.12;
    const isInsideNotch = ny > (bmBottom - notchH) &&
      ny > (bmBottom - Math.abs(nx - cx) * (notchH / (bmRight - cx)));

    if (!isInsideNotch) {
      // Golden / Teal glowing bookmark core
      const glow = (ny - bmTop) / (bmBottom - bmTop);
      return {
        r: Math.round(255 - glow * 20),
        g: Math.round(255 - glow * 30),
        b: Math.round(255 - glow * 10),
        a: 255
      };
    }
  }

  // Small sparkles or category dots
  const dot1 = Math.hypot(nx - 0.24, ny - 0.28) < 0.04;
  const dot2 = Math.hypot(nx - 0.76, ny - 0.72) < 0.04;
  if (dot1 || dot2) {
    return { r: 76, g: 201, b: 240, a: 255 }; // Bright cyan dot
  }

  return { r, g, b, a: 255 };
}

[16, 32, 48, 128].forEach(size => {
  const png = createPng(size, size, drawIcon);
  fs.writeFileSync(`icons/icon${size}.png`, png);
  console.log(`Generated icons/icon${size}.png`);
});

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a86ff"/>
      <stop offset="100%" stop-color="#8338ec"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect x="10" y="10" width="108" height="108" rx="26" fill="url(#bg)" filter="url(#glow)"/>
  <path d="M42 28 H86 V98 L64 84 L42 98 Z" fill="#ffffff" filter="url(#glow)"/>
  <path d="M50 44 H78 M50 56 H72 M50 68 H66" stroke="#4361ee" stroke-width="4" stroke-linecap="round"/>
  <circle cx="96" cy="32" r="6" fill="#4cc9f0"/>
  <circle cx="32" cy="96" r="5" fill="#4cc9f0"/>
</svg>`;

fs.writeFileSync('icons/icon.svg', svgContent);
console.log('Generated icons/icon.svg');
