import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb, toPublicUser } from "../db";
import {
  clearAuthCookie,
  getPublicUserFromRequest,
  requireAuth,
  setAuthCookie,
  signAuthToken,
} from "../auth";
import type { DbUser, UserRole } from "../types";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const body = req.body as { login?: string; password?: string };

  const login = body.login?.trim();
  const password = body.password;

  if (!login || !password) {
    res.status(400).json({ error: "INVALID_INPUT" });
    return;
  }

  const db = getDb();
  const user = db
    .prepare(`SELECT id, login, password_hash, role FROM users WHERE login = ?`)
    .get(login) as DbUser | undefined;

  if (!user) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const token = signAuthToken({
    sub: user.id,
    role: user.role as UserRole,
  });

  setAuthCookie(res, token);
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: getPublicUserFromRequest(req) });
});
