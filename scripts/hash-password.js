import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.ADMIN_PASSWORD_INPUT;
if (!password || password.length < 12) {
  console.error("Set ADMIN_PASSWORD_INPUT to a password containing at least 12 characters.");
  process.exit(1);
}

const cost = 16384;
const blockSize = 8;
const parallelization = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, {
  N: cost,
  r: blockSize,
  p: parallelization,
  maxmem: 64 * 1024 * 1024,
});

console.log(
  [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$"),
);
