import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { getDb, toPublicUser } from "./db";
import type { DbUser, JwtPayload, PublicUser } from "./types";

const COOKIE_NAME = "auth_token";

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-change-me";
}

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function readTokenFromRequest(req: Request): string | undefined {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = readTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    const db = getDb();
    const user = db
      .prepare(`SELECT id, login, password_hash, role FROM users WHERE id = ?`)
      .get(decoded.sub) as DbUser | undefined;

    if (!user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    req.user = toPublicUser(user);
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}

export function getPublicUserFromRequest(req: Request): PublicUser | undefined {
  return req.user;
}
