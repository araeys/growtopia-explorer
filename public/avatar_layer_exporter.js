(function avatarLayerExporterModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AvatarLayerExporter = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createAvatarLayerExporter() {
    const EXPORT_SCHEMA_VERSION = 1;
    const BASE_PART_KEYS = Object.freeze([
      "tangan-kanan",
      "kaki-kiri",
      "kaki-kanan",
      "body",
      "head-utuh",
      "head-bolong",
      "bola-mata",
      "pupil",
      "mulut",
      "tutup-mata",
      "expression",
      "tangan-kiri"
    ]);

    function validateDimensions(width, height) {
      if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
      ) {
        throw new TypeError("Image dimensions must be positive integers");
      }
    }

    function validateRgba(rgba, width, height) {
      validateDimensions(width, height);
      if (!rgba || rgba.length !== width * height * 4) {
        throw new RangeError("RGBA length does not match image dimensions");
      }
    }

    function safeSlug(value) {
      return (
        String(value || "item")
          .normalize("NFKD")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/['’]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "item"
      );
    }

    function normalizeOffset(offset) {
      return {
        x: Number.isFinite(Number(offset && offset.x))
          ? Math.trunc(Number(offset.x))
          : 0,
        y: Number.isFinite(Number(offset && offset.y))
          ? Math.trunc(Number(offset.y))
          : 0
      };
    }

    function buildExportPlan({
      canvas,
      playerOrigin,
      scale,
      skinTone,
      expressionId,
      manifestVersion,
      slotConfig,
      equipped,
      getUserOffset
    }) {
      const canvasSize = {
        width: Number(canvas && canvas.width),
        height: Number(canvas && canvas.height)
      };
      validateDimensions(canvasSize.width, canvasSize.height);
      const origin = normalizeOffset(playerOrigin);
      const avatarScale = Number(scale);
      if (!Number.isFinite(avatarScale) || avatarScale <= 0) {
        throw new TypeError("Avatar scale must be positive");
      }

      const slots = Array.isArray(slotConfig) ? slotConfig : [];
      const equippedItems = equipped || {};
      const offsetResolver =
        typeof getUserOffset === "function"
          ? getUserOffset
          : () => ({ x: 0, y: 0 });
      const layers = [];

      function addLayer(layer) {
        layers.push({
          ...layer,
          zIndex: layers.length
        });
      }

      function addBase(key, phase) {
        addLayer({
          kind: "base",
          key,
          phase,
          filename: `base/${key}.png`,
          finalLogicalOrigin: { ...origin }
        });
      }

      function addWearables(phase) {
        slots.forEach(slot => {
          if (slot.phase !== phase) return;
          const item = equippedItems[slot.key];
          if (!item) return;
          const systemicAnchor = normalizeOffset(slot.defaultOffset);
          const userOffset = normalizeOffset(
            offsetResolver(slot.key, item.id)
          );
          const finalLogicalOrigin = {
            x: origin.x + systemicAnchor.x + userOffset.x,
            y: origin.y + systemicAnchor.y + userOffset.y
          };
          const zLabel = String(layers.length).padStart(3, "0");
          addLayer({
            kind: "wearable",
            slot: slot.key,
            phase,
            itemId: Number(item.id),
            itemName: String(item.name || `Item ${item.id}`),
            item,
            systemicAnchor,
            userOffset,
            finalLogicalOrigin,
            filename:
              `wearables/${zLabel}-${safeSlug(slot.key)}-` +
              `${Number(item.id)}-${safeSlug(item.name)}.png`
          });
        });
      }

      const activeExprId = Number(expressionId) || 0;

      addWearables("behind-base");

      // Active Base Layers
      addBase("tangan-kanan", "base");
      addBase("kaki-kiri", "base");
      addBase("kaki-kanan", "base");
      addBase("body", "base");

      if (activeExprId === 0) {
        // Normal Expression Mode: Head Bolong + Eye Parts + Mouth
        addBase("bola-mata", "base");
        addBase("pupil", "base");
        addBase("head-bolong", "base");
        addBase("mulut", "base");
        addBase("tutup-mata", "base");
      } else {
        // Non-Normal Expression Mode: Solid Head Utuh
        addBase("head-utuh", "base");
      }

      addWearables("pre-expression");

      if (activeExprId !== 0) {
        addBase("expression", "expression");
      }

      addWearables("wearable");
      addBase("tangan-kiri", "front");

      return {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        canvas: canvasSize,
        avatar: {
          scale: avatarScale,
          playerOrigin: origin,
          skinTone: String(skinTone || ""),
          expressionId: Number(expressionId) || 0
        },
        manifestVersion: manifestVersion ?? null,
        layers
      };
    }

    function buildLayersMetadata(plan) {
      const layers = (plan.layers || []).map(layer => {
        const metadata = {
          filename: layer.filename,
          kind: layer.kind,
          zIndex: layer.zIndex,
          phase: layer.phase,
          finalLogicalOrigin: layer.finalLogicalOrigin
        };
        if (layer.kind === "wearable") {
          metadata.slot = layer.slot;
          metadata.itemId = layer.itemId;
          metadata.itemName = layer.itemName;
          metadata.systemicAnchor = layer.systemicAnchor;
          metadata.userOffset = layer.userOffset;
        } else {
          metadata.key = layer.key;
        }
        return metadata;
      });
      return (
        JSON.stringify(
          {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            canvas: plan.canvas,
            avatar: plan.avatar,
            manifestVersion: plan.manifestVersion,
            layers
          },
          null,
          2
        ) + "\n"
      );
    }

    function crc32(bytes) {
      let crc = 0xffffffff;
      for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
          crc =
            (crc >>> 1) ^
            ((crc & 1) ? 0xedb88320 : 0);
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    }

    function writeU16(target, offset, value) {
      target[offset] = value & 0xff;
      target[offset + 1] = (value >>> 8) & 0xff;
    }

    function writeU32(target, offset, value) {
      target[offset] = value & 0xff;
      target[offset + 1] = (value >>> 8) & 0xff;
      target[offset + 2] = (value >>> 16) & 0xff;
      target[offset + 3] = (value >>> 24) & 0xff;
    }

    function readU16(source, offset) {
      return source[offset] | (source[offset + 1] << 8);
    }

    function readU32(source, offset) {
      return (
        source[offset] |
        (source[offset + 1] << 8) |
        (source[offset + 2] << 16) |
        (source[offset + 3] << 24)
      ) >>> 0;
    }

    function concatBytes(chunks) {
      const length = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
      );
      const output = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      return output;
    }

    function validateZipPath(name) {
      const value = String(name || "");
      const segments = value.split("/");
      if (
        !value ||
        value.startsWith("/") ||
        value.includes("\\") ||
        segments.some(segment => !segment || segment === "." || segment === "..")
      ) {
        throw new TypeError(`Invalid relative ZIP path: ${value}`);
      }
      return value;
    }

    function createStoredZip(entries) {
      const encoder = new TextEncoder();
      const normalized = (Array.isArray(entries) ? entries : [])
        .map(entry => ({
          name: validateZipPath(entry && entry.name),
          bytes:
            entry && entry.bytes instanceof Uint8Array
              ? entry.bytes
              : new Uint8Array(entry && entry.bytes ? entry.bytes : [])
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      for (let index = 1; index < normalized.length; index += 1) {
        if (normalized[index - 1].name === normalized[index].name) {
          throw new Error(`Duplicate ZIP path: ${normalized[index].name}`);
        }
      }

      const localChunks = [];
      const centralChunks = [];
      let localOffset = 0;
      const utf8Flag = 0x0800;
      const dosTime = 0;
      const dosDate = 33;

      normalized.forEach(entry => {
        const nameBytes = encoder.encode(entry.name);
        const checksum = crc32(entry.bytes);
        const local = new Uint8Array(30 + nameBytes.length);
        writeU32(local, 0, 0x04034b50);
        writeU16(local, 4, 20);
        writeU16(local, 6, utf8Flag);
        writeU16(local, 8, 0);
        writeU16(local, 10, dosTime);
        writeU16(local, 12, dosDate);
        writeU32(local, 14, checksum);
        writeU32(local, 18, entry.bytes.length);
        writeU32(local, 22, entry.bytes.length);
        writeU16(local, 26, nameBytes.length);
        writeU16(local, 28, 0);
        local.set(nameBytes, 30);
        localChunks.push(local, entry.bytes);

        const central = new Uint8Array(46 + nameBytes.length);
        writeU32(central, 0, 0x02014b50);
        writeU16(central, 4, 20);
        writeU16(central, 6, 20);
        writeU16(central, 8, utf8Flag);
        writeU16(central, 10, 0);
        writeU16(central, 12, dosTime);
        writeU16(central, 14, dosDate);
        writeU32(central, 16, checksum);
        writeU32(central, 20, entry.bytes.length);
        writeU32(central, 24, entry.bytes.length);
        writeU16(central, 28, nameBytes.length);
        writeU16(central, 30, 0);
        writeU16(central, 32, 0);
        writeU16(central, 34, 0);
        writeU16(central, 36, 0);
        writeU32(central, 38, 0);
        writeU32(central, 42, localOffset);
        central.set(nameBytes, 46);
        centralChunks.push(central);

        localOffset += local.length + entry.bytes.length;
      });

      const centralDirectory = concatBytes(centralChunks);
      const end = new Uint8Array(22);
      writeU32(end, 0, 0x06054b50);
      writeU16(end, 4, 0);
      writeU16(end, 6, 0);
      writeU16(end, 8, normalized.length);
      writeU16(end, 10, normalized.length);
      writeU32(end, 12, centralDirectory.length);
      writeU32(end, 16, localOffset);
      writeU16(end, 20, 0);

      return concatBytes([...localChunks, centralDirectory, end]);
    }

    function listStoredZipNames(bytes) {
      const source =
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (
        source.length < 22 ||
        readU32(source, source.length - 22) !== 0x06054b50
      ) {
        throw new Error("Invalid ZIP end record");
      }
      const decoder = new TextDecoder();
      const endOffset = source.length - 22;
      const entryCount = readU16(source, endOffset + 10);
      let offset = readU32(source, endOffset + 16);
      const names = [];
      for (let index = 0; index < entryCount; index += 1) {
        if (readU32(source, offset) !== 0x02014b50) {
          throw new Error("Invalid ZIP central directory");
        }
        const nameLength = readU16(source, offset + 28);
        const extraLength = readU16(source, offset + 30);
        const commentLength = readU16(source, offset + 32);
        names.push(
          decoder.decode(source.subarray(offset + 46, offset + 46 + nameLength))
        );
        offset += 46 + nameLength + extraLength + commentLength;
      }
      return names;
    }

    function assertEqualRgba(actual, expected, layerName = "layer", maxTolerance = 4) {
      if (!actual || !expected || actual.length !== expected.length) {
        throw new Error(
          `${layerName} RGBA length mismatch: ` +
          `${actual ? actual.length : 0} !== ${expected ? expected.length : 0}`
        );
      }
      for (let index = 0; index < actual.length; index += 1) {
        const diff = Math.abs(actual[index] - expected[index]);
        if (diff > maxTolerance) {
          throw new Error(
            `${layerName} RGBA mismatch at byte ${index}: ` +
            `${actual[index]} !== ${expected[index]}`
          );
        }
      }
      return true;
    }

    return Object.freeze({
      EXPORT_SCHEMA_VERSION,
      BASE_PART_KEYS,
      safeSlug,
      buildExportPlan,
      buildLayersMetadata,
      crc32,
      createStoredZip,
      listStoredZipNames,
      assertEqualRgba
    });
  }
);
