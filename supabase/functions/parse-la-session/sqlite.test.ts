import { describe, expect, it } from "vitest";

import { extractNwmBlob } from "./sqlite.ts";

const PAGE_SIZE = 512;

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 8;
  bytes[offset + 1] = value & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = value >>> 16;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value & 0xff;
}

function encodeVarint(value: number): number[] {
  const chunks = [value & 0x7f];
  for (let remaining = value >>> 7; remaining > 0; remaining >>>= 7) {
    chunks.unshift((remaining & 0x7f) | 0x80);
  }
  return chunks;
}

function makeHeader(pageCount: number): Uint8Array {
  const bytes = new Uint8Array(pageCount * PAGE_SIZE);
  bytes.set(new TextEncoder().encode("SQLite format 3\0"));
  writeUint16(bytes, 16, PAGE_SIZE);
  writeUint32(bytes, 28, pageCount);
  return bytes;
}

function makeRealBeforeBlobDatabase(overflowPage = 2): {
  database: Uint8Array;
  expectedBlob: Uint8Array;
} {
  const database = makeHeader(3);
  const expectedBlob = Uint8Array.from(
    { length: 1001 },
    (_, index) => index % 251
  );
  const name = new TextEncoder().encode("nwm3Xml");
  const real = new Uint8Array(8).fill(0x44);
  const blobSerialType = 12 + expectedBlob.length * 2;
  const recordHeader = Uint8Array.from([
    5,
    13 + name.length * 2,
    7,
    ...encodeVarint(blobSerialType),
  ]);
  const payload = new Uint8Array(
    recordHeader.length + name.length + real.length + expectedBlob.length
  );
  payload.set(recordHeader);
  payload.set(name, recordHeader.length);
  payload.set(real, recordHeader.length + name.length);
  payload.set(expectedBlob, recordHeader.length + name.length + real.length);

  const pageHeader = 100;
  const cellOffset = 460;
  database[pageHeader] = 0x0d;
  writeUint16(database, pageHeader + 3, 1);
  writeUint16(database, pageHeader + 5, cellOffset);
  writeUint16(database, pageHeader + 8, cellOffset);

  const localPayloadLength = 39;
  const cell = Uint8Array.from([
    ...encodeVarint(payload.length),
    1,
    ...payload.subarray(0, localPayloadLength),
    (overflowPage >>> 24) & 0xff,
    (overflowPage >>> 16) & 0xff,
    (overflowPage >>> 8) & 0xff,
    overflowPage & 0xff,
  ]);
  database.set(cell, cellOffset);

  writeUint32(database, PAGE_SIZE, 3);
  database.set(
    payload.subarray(localPayloadLength, localPayloadLength + 508),
    PAGE_SIZE + 4
  );
  writeUint32(database, PAGE_SIZE * 2, 0);
  database.set(payload.subarray(localPayloadLength + 508), PAGE_SIZE * 2 + 4);

  return { database, expectedBlob };
}

describe("extractNwmBlob", () => {
  it("accounts for an 8-byte REAL column before the target BLOB", () => {
    const { database, expectedBlob } = makeRealBeforeBlobDatabase();

    expect(extractNwmBlob(database)).toEqual(expectedBlob);
  });

  it("rejects a declared page count larger than the uploaded file", () => {
    const database = makeHeader(1);
    writeUint32(database, 28, 2);

    expect(() => extractNwmBlob(database)).toThrow("Invalid SQLite page count");
  });

  it("rejects overflow pointers outside the uploaded database", () => {
    const { database } = makeRealBeforeBlobDatabase(4);

    expect(() => extractNwmBlob(database)).toThrow(
      "Invalid SQLite overflow page"
    );
  });
});
