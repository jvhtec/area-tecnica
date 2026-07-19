// Minimal read-only SQLite reader: extracts a single BLOB column from the
// table-leaf row whose first TEXT column equals `matchName`. Purpose-built for
// L-Acoustics Network Manager `.nwm` session files (a SQLite database whose
// payload lives in one `chunks` row), so we avoid shipping a full SQLite/WASM
// engine into the Edge Function. Validated byte-exact against the reference
// sqlite3 engine on real session files.

function readVarint(buf: Uint8Array, off: number): [number, number] {
  let result = 0n;
  let i = 0;
  for (; i < 9; i++) {
    if (off + i >= buf.length) throw new Error("Invalid SQLite varint");
    const byte = buf[off + i];
    if (i === 8) {
      result = (result << 8n) | BigInt(byte);
      break;
    }
    result = (result << 7n) | BigInt(byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  const value = Number(result);
  if (!Number.isSafeInteger(value)) throw new Error("Invalid SQLite varint");
  return [value, i + 1];
}

interface RecordColumn {
  serialType: number;
  offset: number;
  length: number;
}

/**
 * Extracts the BLOB stored in the `chunks` row named `matchName` from a `.nwm`
 * SQLite database. Handles overflow-paged blobs by following the overflow
 * chain. Throws if the file is not a SQLite database or the row is absent.
 */
export function extractNwmBlob(buf: Uint8Array, matchName = "nwm3Xml"): Uint8Array {
  if (
    buf.length < 100 ||
    String.fromCharCode(...buf.subarray(0, 16)) !== "SQLite format 3\0"
  ) {
    throw new Error("Not a SQLite database");
  }

  let pageSize = (buf[16] << 8) | buf[17];
  if (pageSize === 1) pageSize = 65536;
  const reserved = buf[20];
  const usable = pageSize - reserved;
  if (
    pageSize < 512 ||
    pageSize > 65536 ||
    (pageSize & (pageSize - 1)) !== 0 ||
    usable < 480
  ) {
    throw new Error("Invalid SQLite page size");
  }
  const physicalPages = Math.floor(buf.length / pageSize);
  const numPages = ((buf[28] << 24) | (buf[29] << 16) | (buf[30] << 8) | buf[31]) >>> 0;
  if (numPages === 0 || numPages > physicalPages) {
    throw new Error("Invalid SQLite page count");
  }
  const nameBytes = new TextEncoder().encode(matchName);

  const readCellPayload = (firstPayload: Uint8Array, payloadLen: number): Uint8Array => {
    if (!Number.isSafeInteger(payloadLen) || payloadLen <= 0 || payloadLen > buf.length) {
      throw new Error("Invalid SQLite payload length");
    }
    const maxLocal = usable - 35;
    if (payloadLen <= maxLocal) {
      if (firstPayload.length < payloadLen) throw new Error("Truncated SQLite payload");
      return firstPayload.subarray(0, payloadLen);
    }

    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;
    let local = minLocal + ((payloadLen - minLocal) % (usable - 4));
    if (local > maxLocal) local = minLocal;
    if (firstPayload.length < local + 4) throw new Error("Truncated SQLite overflow payload");

    const out = new Uint8Array(payloadLen);
    out.set(firstPayload.subarray(0, local), 0);
    let filled = local;
    let overflowPage =
      ((firstPayload[local] << 24) |
        (firstPayload[local + 1] << 16) |
        (firstPayload[local + 2] << 8) |
        firstPayload[local + 3]) >>>
      0;
    const visited = new Set<number>();

    while (overflowPage !== 0 && filled < payloadLen) {
      if (overflowPage < 1 || overflowPage > numPages || visited.has(overflowPage)) {
        throw new Error("Invalid SQLite overflow page");
      }
      visited.add(overflowPage);
      const base = (overflowPage - 1) * pageSize;
      if (base + usable > buf.length) throw new Error("Invalid SQLite overflow page");
      const next =
        ((buf[base] << 24) | (buf[base + 1] << 16) | (buf[base + 2] << 8) | buf[base + 3]) >>> 0;
      const take = Math.min(usable - 4, payloadLen - filled);
      const chunk = buf.subarray(base + 4, base + 4 + take);
      if (chunk.length !== take) throw new Error("Truncated SQLite overflow payload");
      out.set(chunk, filled);
      filled += take;
      overflowPage = next;
    }
    if (filled !== payloadLen) throw new Error("Truncated SQLite overflow chain");
    return out;
  };

  const parseRecordColumns = (payload: Uint8Array): RecordColumn[] => {
    const [headerLen, headerBytes] = readVarint(payload, 0);
    if (headerLen < headerBytes || headerLen > payload.length) {
      throw new Error("Invalid SQLite record header");
    }
    const serials: number[] = [];
    let p = headerBytes;
    while (p < headerLen) {
      const [serialType, n] = readVarint(payload, p);
      if (p + n > headerLen) throw new Error("Invalid SQLite record header");
      serials.push(serialType);
      p += n;
    }
    const columns: RecordColumn[] = [];
    let body = headerLen;
    for (const serialType of serials) {
      let length = 0;
      if (serialType >= 1 && serialType <= 7) length = [0, 1, 2, 3, 4, 6, 8, 8][serialType];
      else if (serialType >= 12 && serialType % 2 === 0) length = (serialType - 12) / 2;
      else if (serialType >= 13) length = (serialType - 13) / 2;
      if (!Number.isSafeInteger(length) || body + length > payload.length) {
        throw new Error("Invalid SQLite record column");
      }
      columns.push({ serialType, offset: body, length });
      body += length;
    }
    return columns;
  };

  for (let pg = 1; pg <= numPages; pg++) {
    const base = (pg - 1) * pageSize;
    const pageEnd = Math.min(base + pageSize, buf.length);
    const hdrOff = pg === 1 ? base + 100 : base;
    if (hdrOff + 8 > pageEnd) throw new Error("Truncated SQLite page header");
    if (buf[hdrOff] !== 0x0d) continue; // table b-tree leaf pages only

    const nCells = (buf[hdrOff + 3] << 8) | buf[hdrOff + 4];
    const cellPtrArray = hdrOff + 8;
    if (cellPtrArray + nCells * 2 > pageEnd) throw new Error("Invalid SQLite cell pointers");
    for (let c = 0; c < nCells; c++) {
      const relativeCellPtr =
        (buf[cellPtrArray + c * 2] << 8) | buf[cellPtrArray + c * 2 + 1];
      const cellPtr = base + relativeCellPtr;
      if (relativeCellPtr >= pageSize || cellPtr >= pageEnd) {
        throw new Error("Invalid SQLite cell pointer");
      }
      let o = cellPtr;
      const [payloadLen, a] = readVarint(buf, o);
      o += a;
      const [, b] = readVarint(buf, o); // rowid (unused)
      o += b;
      if (o > pageEnd) throw new Error("Truncated SQLite cell");

      const first = buf.subarray(o, pageEnd);
      const payload = readCellPayload(first, payloadLen);
      const columns = parseRecordColumns(payload);

      const nameCol = columns[0];
      if (nameCol && nameCol.serialType >= 13 && nameCol.length === nameBytes.length) {
        const name = payload.subarray(nameCol.offset, nameCol.offset + nameCol.length);
        if (name.every((v, i) => v === nameBytes[i])) {
          const blobCol = columns.find(
            (col) => col.serialType >= 12 && col.serialType % 2 === 0 && col.length > 1000,
          );
          if (blobCol) return payload.subarray(blobCol.offset, blobCol.offset + blobCol.length);
        }
      }
    }
  }

  throw new Error(`Chunk '${matchName}' not found in .nwm database`);
}
