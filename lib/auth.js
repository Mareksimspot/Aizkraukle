import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE = "aizkraukle_admin";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

function sign(value) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header) {
  const cookies = {};
  for (const part of (header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = "";
    }
  }
  return cookies;
}

export function verifyPassword(password) {
  const encoded = process.env.ADMIN_PASSWORD_HASH || "";
  const [algorithm, cost, blockSize, parallelization, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !salt || !expected) {
    throw new Error("ADMIN_PASSWORD_HASH is not configured correctly");
  }

  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 64, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: 64 * 1024 * 1024,
  }).toString("base64url");
  return safeEqual(actual, expected);
}

export function createSession(username) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({ username, expires, nonce: randomBytes(16).toString("base64url") }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(request) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.username || session.expires <= Math.floor(Date.now() / 1000)) return null;
    return { ...session, token };
  } catch {
    return null;
  }
}

export function csrfToken(sessionToken) {
  return sign(`csrf:${sessionToken}`);
}

export function isValidCsrf(request, session) {
  const supplied = request.headers.get("x-csrf-token") || "";
  return supplied && safeEqual(supplied, csrfToken(session.token));
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

export function expiredSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
