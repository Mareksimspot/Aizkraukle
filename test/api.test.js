import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import { POST as login } from "../api/login.js";
import { GET as sessionStatus } from "../api/session.js";
import { GET as getTimetable, PUT as putTimetable } from "../api/timetable.js";

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
  assert.ok(version);

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
});
