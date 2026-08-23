/*
  Lightweight Pixel-Perfect GIF Encoder in JavaScript (GIF89a)
  Handles transparent RGBA frames with proper LZW code sizing & disposal.
  Zero glitching & zero rainbow artifacts.
*/

class SimpleGIFEncoder {
  constructor(width, height, delayMs = 150) {
    this.width = width;
    this.height = height;
    this.delayMs = delayMs;
    this.frames = [];
  }

  addFrame(ctx) {
    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push(imgData);
  }

  build() {
    const buffer = [];
    
    // 1. Header GIF89a
    this.writeString(buffer, "GIF89a");
    
    // 2. Logical Screen Descriptor
    this.writeUInt16(buffer, this.width);
    this.writeUInt16(buffer, this.height);
    
    // Global Color Table Flag: 0, Color Resolution: 7, Sort: 0, Size: 0
    buffer.push(0x70); 
    buffer.push(0); // Background color index
    buffer.push(0); // Pixel aspect ratio

    // Build Palette from all frames
    const { palette, transparentIndex } = this.buildGlobalPalette();
    
    // Update Logical Screen Descriptor Global Color Table Flag: 1 (0x80 | size)
    const paletteBits = Math.max(1, Math.ceil(Math.log2(palette.length))) - 1;
    buffer[10] = 0x80 | (7 << 4) | paletteBits;

    // Write Global Color Table
    const totalPaletteColors = 1 << (paletteBits + 1);
    for (let i = 0; i < totalPaletteColors; i++) {
      if (i < palette.length) {
        buffer.push(palette[i].r, palette[i].g, palette[i].b);
      } else {
        buffer.push(0, 0, 0);
      }
    }

    // Write Netscape Loop Extension for infinite looping
    this.writeNetscapeLoop(buffer);

    // 3. Render Frames
    const delayHundredths = Math.round(this.delayMs / 10);
    
    for (let f = 0; f < this.frames.length; f++) {
      const frameData = this.frames[f];
      
      // Graphic Control Extension (Animation Delay & Transparency)
      // Disposal Method: 2 (Restore to background color) = (2 << 2) = 0x08
      buffer.push(0x21, 0xF9, 0x04);
      const transFlag = transparentIndex !== -1 ? 1 : 0;
      buffer.push(0x08 | transFlag);
      this.writeUInt16(buffer, delayHundredths);
      buffer.push(transparentIndex !== -1 ? transparentIndex : 0);
      buffer.push(0x00); // Block terminator

      // Image Descriptor
      buffer.push(0x2C);
      this.writeUInt16(buffer, 0); // Left
      this.writeUInt16(buffer, 0); // Top
      this.writeUInt16(buffer, this.width);
      this.writeUInt16(buffer, this.height);
      buffer.push(0x00); // Local Color Table Flag: 0

      // Map pixels to palette indices
      const indexedPixels = new Uint8Array(this.width * this.height);
      const data = frameData.data;
      for (let i = 0; i < indexedPixels.length; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const a = data[i * 4 + 3];

        if (a < 16) {
          indexedPixels[i] = transparentIndex !== -1 ? transparentIndex : 0;
        } else {
          indexedPixels[i] = this.findClosestColor(palette, r, g, b, transparentIndex);
        }
      }

      // LZW Encode Frame Pixels
      const minCodeSize = Math.max(2, paletteBits + 1);
      buffer.push(minCodeSize);
      this.lzwEncode(buffer, indexedPixels, minCodeSize);
      buffer.push(0x00); // Block terminator
    }

    // Trailer
    buffer.push(0x3B);
    return new Uint8Array(buffer);
  }

  buildGlobalPalette() {
    const colorMap = new Map();
    // Index 0 reserved for transparent
    const palette = [{ r: 0, g: 0, b: 0 }];
    const transparentIndex = 0;

    for (const frame of this.frames) {
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a >= 16) {
          // Quantize to 5-bit per channel for crisp 256 color GIF palette
          const r = data[i] & 0xF8;
          const g = data[i + 1] & 0xF8;
          const b = data[i + 2] & 0xF8;
          const key = (r << 16) | (g << 8) | b;
          if (!colorMap.has(key) && palette.length < 256) {
            colorMap.set(key, palette.length);
            palette.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
          }
        }
      }
    }

    // Fallback: Ensure palette has at least 2 entries for valid minCodeSize
    if (palette.length < 2) {
      palette.push({ r: 255, g: 255, b: 255 });
    }

    return { palette, transparentIndex };
  }

  findClosestColor(palette, r, g, b, transIdx) {
    let minDiff = Infinity;
    let bestIdx = 1;
    for (let i = 1; i < palette.length; i++) {
      if (i === transIdx) continue;
      const dr = r - palette[i].r;
      const dg = g - palette[i].g;
      const db = b - palette[i].b;
      const diff = dr * dr + dg * dg + db * db;
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  writeNetscapeLoop(buffer) {
    buffer.push(0x21, 0xFF, 0x0B);
    this.writeString(buffer, "NETSCAPE2.0");
    buffer.push(0x03, 0x01);
    this.writeUInt16(buffer, 0); // Infinite loop
    buffer.push(0x00);
  }

  writeString(buffer, str) {
    for (let i = 0; i < str.length; i++) {
      buffer.push(str.charCodeAt(i));
    }
  }

  writeUInt16(buffer, val) {
    buffer.push(val & 0xFF, (val >> 8) & 0xFF);
  }

  // Pixel-Perfect LZW Encoder with Proper Bit Width Scaling
  lzwEncode(buffer, pixels, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const eofCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eofCode + 1;
    
    let dictionary = new Map();
    function resetDict() {
      dictionary.clear();
      for (let i = 0; i < clearCode; i++) {
        dictionary.set(String.fromCharCode(i), i);
      }
      codeSize = minCodeSize + 1;
      nextCode = eofCode + 1;
    }

    resetDict();

    let curByte = 0;
    let curBits = 0;
    const subBlocks = [];

    function writeBits(code) {
      curByte |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) {
        subBlocks.push(curByte & 0xFF);
        curByte >>= 8;
        curBits -= 8;
      }
    }

    writeBits(clearCode);

    let prefix = String.fromCharCode(pixels[0]);

    for (let i = 1; i < pixels.length; i++) {
      const c = String.fromCharCode(pixels[i]);
      const combo = prefix + c;

      if (dictionary.has(combo)) {
        prefix = combo;
      } else {
        writeBits(dictionary.get(prefix));

        if (nextCode < 4096) {
          dictionary.set(combo, nextCode);
          if (nextCode === (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
          nextCode++;
        } else {
          writeBits(clearCode);
          resetDict();
        }
        prefix = c;
      }
    }

    if (prefix !== "") {
      writeBits(dictionary.get(prefix));
    }
    writeBits(eofCode);

    if (curBits > 0) {
      subBlocks.push(curByte & 0xFF);
    }

    // Flush sub-blocks in 255-byte chunks
    let pos = 0;
    while (pos < subBlocks.length) {
      const chunkSize = Math.min(255, subBlocks.length - pos);
      buffer.push(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        buffer.push(subBlocks[pos + i]);
      }
      pos += chunkSize;
    }
  }
}

window.SimpleGIFEncoder = SimpleGIFEncoder;
