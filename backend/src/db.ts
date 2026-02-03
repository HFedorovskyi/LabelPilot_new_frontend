import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import type { DbUser, PublicUser, UserRole } from "./types";

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), "backend", "data", "app.db");

export function getDb() {
  if (globalThis.__dbSingleton) return globalThis.__dbSingleton;

  const sqlitePath = process.env.SQLITE_PATH ?? DEFAULT_SQLITE_PATH;
  const dir = path.dirname(sqlitePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
  `);

  globalThis.__dbSingleton = db;
  return db;
}

export function ensureInitialAdmin() {
  const db = getDb();

  const row = db
    .prepare(`SELECT id, login, password_hash, role FROM users WHERE login = ?`)
    .get("admin") as DbUser | undefined;

  if (row) return;

  const passwordHash = bcrypt.hashSync("123456", 12);

  db.prepare(
    `INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)`
  ).run("admin", passwordHash, "admin" satisfies UserRole);
}

export function toPublicUser(user: DbUser): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...publicUser } = user;
  return publicUser;
}
