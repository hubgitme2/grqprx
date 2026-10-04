import express from "express";
import { Readable } from "node:stream";

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "https://aisubmedia.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.raw({ type: "*/*", limit: "10mb" }));

app.all("/openai/v1/*", async (req, res) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      error: "Authorization header is required"
    });
  }

  try {
    const targetUrl = `https://api.groq.com${req.originalUrl}`;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        authorization,
        "content-type": req.headers["content-type"] || "application/json",
        accept: req.headers.accept || "*/*"
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      signal: AbortSignal.timeout(120_000)
    });

    res.status(upstream.status);

    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.status(502).json({
      error: "Could not connect to Groq"
    });
  }
});

app.get("/", (_req, res) => {
  res.send("Groq proxy is running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on port ${PORT}`);
});
