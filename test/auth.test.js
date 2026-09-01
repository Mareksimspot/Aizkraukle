import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import {
  createSession,
  csrfToken,
  isSameOrigin,
  isValidCsrf,
  readSession,
  sessionCookie,
  verifyPassword,
} from "../lib/auth.js";

const password = "droša testa parole";
const salt = Buffer.from("test-salt");
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

process.env.ADMIN_PASSWORD_HASH = `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
process.env.SESSION_SECRET = "test-session-secret-with-more-than-32-characters";

test("password hashes are verified", () => {
  assert.equal(verifyPassword(password), true);
  assert.equal(verifyPassword("nepareiza parole"), false);
});

test("signed sessions and CSRF tokens are verified", () => {
  const token = createSession("admin");
  const cookie = sessionCookie(token, new Request("https://example.com"));
  const request = new Request("https://example.com/api/session", { headers: { cookie } });
  const session = readSession(request);
  assert.equal(session.username, "admin");

  const csrf = csrfToken(token);
  const mutation = new Request("https://example.com/api/timetable", {
    method: "PUT",
    headers: { cookie, "x-csrf-token": csrf },
  });
  assert.equal(isValidCsrf(mutation, session), true);
});

test("mutation origins must match", () => {
  assert.equal(
    isSameOrigin(new Request("https://example.com/api/login", { headers: { origin: "https://example.com" } })),
    true,
  );
  assert.equal(
    isSameOrigin(new Request("https://example.com/api/login", { headers: { origin: "https://attacker.test" } })),
    false,
  );
});
