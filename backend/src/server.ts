import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ensureInitialAdmin } from "./db";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";

const app = express();

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

ensureInitialAdmin();

app.disable("x-powered-by");

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", path: req.path });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

app.listen(PORT, () => {
  // Intentionally minimal log
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
