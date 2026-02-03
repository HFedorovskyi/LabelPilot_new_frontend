import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb, toPublicUser } from "../db";
import { requireAdmin, requireAuth } from "../auth";
import type { DbUser, UserRole } from "../types";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireAdmin, (_req, res) => {
  const db = getDb();
  const users = db
    .prepare(`SELECT id, login, password_hash, role FROM users ORDER BY id ASC`)
    .all() as DbUser[];

  res.json({ users: users.map(toPublicUser) });
});

usersRouter.post("/", requireAuth, requireAdmin, (req, res) => {
  const body = req.body as {
    login?: string;
    password?: string;
    role?: UserRole;
  };

  const login = body.login?.trim();
  const password = body.password;
  const role = body.role ?? "user";

  if (!login || !password) {
    res.status(400).json({ error: "INVALID_INPUT" });
    return;
  }

  if (role !== "admin" && role !== "user") {
    res.status(400).json({ error: "INVALID_ROLE" });
    return;
  }

  const db = getDb();
  const passwordHash = bcrypt.hashSync(password, 12);

  try {
    const info = db
      .prepare(`INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)`)
      .run(login, passwordHash, role);

    const created = db
      .prepare(`SELECT id, login, password_hash, role FROM users WHERE id = ?`)
      .get(Number(info.lastInsertRowid)) as DbUser;

    res.status(201).json({ user: toPublicUser(created) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
      res.status(409).json({ error: "LOGIN_ALREADY_EXISTS" });
      return;
    }
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

usersRouter.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "INVALID_ID" });
    return;
  }

  if (req.user?.id === id) {
    res.status(400).json({ error: "CANNOT_DELETE_SELF" });
    return;
  }

  const db = getDb();
  const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);

  res.json({ ok: true, deleted: info.changes });
});
