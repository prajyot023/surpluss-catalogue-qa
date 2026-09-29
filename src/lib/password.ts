import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

/** Stored form: `scrypt:<saltHex>:<keyHex>`. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = (await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
  )) as Buffer;
  return timingSafeEqual(expected, actual);
}
