import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const BLOB_PATH = "signage/doctors_timetable.json";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];

function hasBlobStore() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

async function localTimetable() {
  const text = await readFile(new URL("../doctors_timetable.json", import.meta.url), "utf8");
  return {
    records: JSON.parse(text),
    version: `local-${createHash("sha256").update(text).digest("hex")}`,
    source: "local",
  };
}

export async function readTimetable() {
  if (!hasBlobStore()) return localTimetable();

  const result = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!result) return localTimetable();
  if (result.statusCode !== 200) throw new Error("Unexpected response from timetable storage");

  const text = await new Response(result.stream).text();
  return {
    records: JSON.parse(text),
    version: result.blob.etag,
    source: "blob",
  };
}

function requiredText(value, field, index, maximum) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Record ${index + 1}: ${field} is required`);
  }
  const text = value.trim();
  if (text.length > maximum) throw new TypeError(`Record ${index + 1}: ${field} is too long`);
  return text;
}

function optionalText(value, field, index, maximum) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new TypeError(`Record ${index + 1}: ${field} is invalid`);
  const text = value.trim();
  if (text.length > maximum) throw new TypeError(`Record ${index + 1}: ${field} is too long`);
  return text || null;
}

function directionIndex(value, index) {
  if (value === null || value === undefined || value === "") return null;
  const direction = Number(value);
  if (!Number.isInteger(direction) || direction < 0 || direction > 3) {
    throw new TypeError(`Record ${index + 1}: direction must be empty or an index from 0 to 3`);
  }
  return direction;
}

export function validateTimetable(records) {
  if (!Array.isArray(records) || records.length === 0 || records.length > 200) {
    throw new TypeError("Timetable must contain between 1 and 200 records");
  }

  return records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError(`Record ${index + 1} is invalid`);
    }
    const normalized = {
      name: requiredText(record.name, "name", index, 200),
      place: optionalText(record.place, "place", index, 30),
    };
    for (const day of DAYS) normalized[day] = optionalText(record[day], day, index, 300);
    normalized.direction = directionIndex(record.direction, index);
    normalized.section = requiredText(record.section, "section", index, 150);
    return normalized;
  });
}

export async function writeTimetable(records, expectedVersion) {
  if (!hasBlobStore()) throw new Error("Vercel Blob is not connected to this project");

  const current = await readTimetable();
  if (expectedVersion && expectedVersion !== current.version) {
    return { conflict: true, currentVersion: current.version };
  }

  const options = {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  };
  if (current.source === "blob") options.ifMatch = current.version;

  try {
    const blob = await put(BLOB_PATH, `${JSON.stringify(records, null, 2)}\n`, options);
    return { conflict: false, version: blob.etag };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return { conflict: true };
    throw error;
  }
}
