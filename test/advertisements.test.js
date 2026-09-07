import assert from "node:assert/strict";
import test from "node:test";
import { readAdvertisements, validateAdvertisements } from "../lib/advertisements.js";

delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

test("local advertisements are the storage fallback", async () => {
  const advertisements = await readAdvertisements();
  assert.equal(advertisements.source, "local");
  assert.deepEqual(advertisements.config, { screens: { 1: null, 2: null } });
  assert.match(advertisements.version, /^local-[a-f0-9]{64}$/);
});

test("advertisement validation accepts supported public Blob media", () => {
  const config = validateAdvertisements({
    screens: {
      1: {
        url: "https://example.public.blob.vercel-storage.com/signage/ads/screen-1/ad.jpg",
        pathname: "signage/ads/screen-1/ad.jpg",
        type: "image/jpeg",
        name: " Reklāma.jpg ",
        size: 2048,
      },
      2: null,
    },
  });
  assert.equal(config.screens[1].name, "Reklāma.jpg");
  assert.equal(config.screens[2], null);
});

test("advertisement validation rejects unsupported or external media", () => {
  assert.throws(
    () => validateAdvertisements({
      screens: {
        1: {
          url: "https://example.com/ad.svg",
          pathname: "signage/ads/ad.svg",
          type: "image/svg+xml",
          name: "ad.svg",
          size: 100,
        },
        2: null,
      },
    }),
    /advertisement URL is invalid/,
  );
});
