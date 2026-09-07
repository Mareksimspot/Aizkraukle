import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";

const BLOB_PATH = "signage/advertisements.json";
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const MAXIMUM_SIZE = 100 * 1024 * 1024;

function hasBlobStore() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

async function localAdvertisements() {
  const text = await readFile(new URL("../advertisements.json", import.meta.url), "utf8");
  return {
    config: JSON.parse(text),
    version: `local-${createHash("sha256").update(text).digest("hex")}`,
    source: "local",
  };
}

export async function readAdvertisements() {
  if (!hasBlobStore()) return localAdvertisements();

  const result = await get(BLOB_PATH, { access: "public", useCache: false });
  if (!result) return localAdvertisements();
  if (result.statusCode !== 200) throw new Error("Unexpected response from advertisement storage");

  const text = await new Response(result.stream).text();
  return {
    config: JSON.parse(text),
    version: result.blob.etag,
    source: "blob",
  };
}

function advertisement(value, screen) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Screen ${screen}: advertisement is invalid`);
  }

  const url = new URL(value.url);
  if (!url.hostname.endsWith(".public.blob.vercel-storage.com") || !url.pathname.startsWith("/signage/ads/")) {
    throw new TypeError(`Screen ${screen}: advertisement URL is invalid`);
  }
  if (typeof value.pathname !== "string" || !value.pathname.startsWith("signage/ads/")) {
    throw new TypeError(`Screen ${screen}: advertisement pathname is invalid`);
  }
  if (!CONTENT_TYPES.has(value.type)) {
    throw new TypeError(`Screen ${screen}: advertisement type is invalid`);
  }
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 200) {
    throw new TypeError(`Screen ${screen}: advertisement name is invalid`);
  }
  if (!Number.isInteger(value.size) || value.size < 1 || value.size > MAXIMUM_SIZE) {
    throw new TypeError(`Screen ${screen}: advertisement size is invalid`);
  }

  return {
    url: url.href,
    pathname: value.pathname,
    type: value.type,
    name: value.name.trim(),
    size: value.size,
  };
}

export function validateAdvertisements(config) {
  if (!config || typeof config !== "object" || Array.isArray(config) || !config.screens) {
    throw new TypeError("Advertisement configuration is invalid");
  }
  return {
    screens: {
      1: advertisement(config.screens["1"], 1),
      2: advertisement(config.screens["2"], 2),
    },
  };
}

export async function writeAdvertisements(config, expectedVersion) {
  if (!hasBlobStore()) throw new Error("Vercel Blob is not connected to this project");

  const current = await readAdvertisements();
  if (expectedVersion && expectedVersion !== current.version) {
    return { conflict: true, currentVersion: current.version };
  }

  const options = {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  };
  if (current.source === "blob") options.ifMatch = current.version;

  try {
    const blob = await put(BLOB_PATH, `${JSON.stringify(config, null, 2)}\n`, options);
    return { conflict: false, version: blob.etag, previous: current.config };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return { conflict: true };
    throw error;
  }
}

export async function removeUnusedMedia(previous, current) {
  const currentUrls = new Set(Object.values(current.screens).filter(Boolean).map((item) => item.url));
  const obsoleteUrls = Object.values(previous.screens)
    .filter(Boolean)
    .map((item) => item.url)
    .filter((url) => !currentUrls.has(url));
  if (obsoleteUrls.length) await del(obsoleteUrls);
}

export { CONTENT_TYPES, MAXIMUM_SIZE };
