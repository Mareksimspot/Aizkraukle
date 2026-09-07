import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import { POST as login } from "../api/login.js";
import { GET as sessionStatus } from "../api/session.js";
import { GET as getTimetable, PUT as putTimetable } from "../api/timetable.js";
import { GET as getAdvertisements, PUT as putAdvertisements } from "../api/advertisements.js";
import { POST as uploadAdvertisement } from "../api/advertisement-upload.js";
import { createSession, csrfToken, sessionCookie } from "../lib/auth.js";

const password = "droša testa parole";
const salt = Buffer.from("api-test-salt");
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD_HASH = `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
process.env.SESSION_SECRET = "api-test-session-secret-with-more-than-32-characters";
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

test("login, session, and public timetable work together", async () => {
  const loginResponse = await login(
    new Request("https://example.com/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ username: "admin", password }),
    }),
  );
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const loginResult = await loginResponse.json();

  const sessionResponse = sessionStatus(
    new Request("https://example.com/api/session", { headers: { cookie } }),
  );
  assert.equal(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).authenticated, true);

  const timetableResponse = await getTimetable(new Request("https://example.com/api/timetable"));
  assert.equal(timetableResponse.status, 200);
  const timetable = await timetableResponse.json();
  const version = timetableResponse.headers.get("x-timetable-version");
  assert.equal(timetable.length, 54);
  assert.equal(timetable.filter((record) => record.screen === 1).length, 27);
  assert.equal(timetable.filter((record) => record.screen === 2).length, 27);
  assert.equal(timetable.some((record) => "sat" in record), false);
  assert.ok(version);

  const advertisementsResponse = await getAdvertisements(
    new Request("https://example.com/api/advertisements"),
  );
  assert.equal(advertisementsResponse.status, 200);
  assert.deepEqual(await advertisementsResponse.json(), { screens: { 1: null, 2: null } });

  const originalConsoleError = console.error;
  console.error = () => {};
  const saveWithoutStorage = await putTimetable(
    new Request("https://example.com/api/timetable", {
      method: "PUT",
      headers: {
        origin: "https://example.com",
        cookie,
        "content-type": "application/json",
        "if-match": version,
        "x-csrf-token": loginResult.csrfToken,
      },
      body: JSON.stringify(timetable),
    }),
  ).finally(() => {
    console.error = originalConsoleError;
  });
  assert.equal(saveWithoutStorage.status, 503);
});

test("writes require authentication", async () => {
  const response = await putTimetable(
    new Request("https://example.com/api/timetable", {
      method: "PUT",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: "[]",
    }),
  );
  assert.equal(response.status, 401);

  const advertisementsResponse = await putAdvertisements(
    new Request("https://example.com/api/advertisements", {
      method: "PUT",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: JSON.stringify({ screens: { 1: null, 2: null } }),
    }),
  );
  assert.equal(advertisementsResponse.status, 401);

  const uploadResponse = await uploadAdvertisement(
    new Request("https://example.com/api/advertisement-upload", {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(uploadResponse.status, 401);
});

test("authenticated advertisement uploads receive a restricted client token", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_fake-secret";
  const token = createSession("admin");
  const cookie = sessionCookie(token, new Request("https://example.com")).split(";")[0];
  const response = await uploadAdvertisement(
    new Request("https://example.com/api/advertisement-upload", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        cookie,
        "content-type": "application/json",
        "x-csrf-token": csrfToken(token),
      },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "signage/ads/screen-2/123-ad.mp4",
          clientPayload: JSON.stringify({ screen: 2 }),
          multipart: true,
        },
      }),
    }),
  ).finally(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.type, "blob.generate-client-token");
  assert.match(result.clientToken, /^vercel_blob_client_/);
});
