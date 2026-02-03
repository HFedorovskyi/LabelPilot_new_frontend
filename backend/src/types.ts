export type UserRole = "admin" | "user";

export type DbUser = {
  id: number;
  login: string;
  password_hash: string;
  role: UserRole;
};

export type PublicUser = Omit<DbUser, "password_hash">;

export type JwtPayload = {
  sub: number; // user id
  role: UserRole;
};

declare global {
  // eslint-disable-next-line no-var
  var __dbSingleton: import("better-sqlite3").Database | undefined;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: PublicUser;
  }
}
