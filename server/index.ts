import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── Security: Helmet HTTP headers ─────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Handled by Vite in dev, nginx in prod
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Allow iframe embedding (Perplexity hosting)
  })
);

// ─── Security: CORS — restrict to known origins ────────────────────────────
// Since HireGenie serves frontend + API from the same Express server,
// same-origin requests (no Origin header) are always allowed.
// For cross-origin (iframe embeds, CDN frontends), we maintain an allowlist.
const ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://localhost:3000",
  "http://0.0.0.0:5000",
  // Add your production domain(s) here when self-hosting:
  // "https://hiregenie.yourdomain.com",
];

// Allow Perplexity hosting domains (iframe embed)
const ALLOWED_ORIGIN_PATTERNS = [
  /\.pplx\.app$/,
  /\.perplexity\.ai$/,
];

// In production, also allow the deployed S3/CDN origins via env var
if (process.env.ALLOWED_ORIGINS) {
  ALLOWED_ORIGINS.push(
    ...process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);
      // Check exact match
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      // Check pattern match (hosting platforms)
      try {
        const hostname = new URL(origin).hostname;
        if (ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(hostname))) {
          return callback(null, true);
        }
      } catch { /* invalid URL, reject */ }
      // In development, allow all origins for convenience
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body parsing with size limits ─────────────────────────────────────────
app.use(
  express.json({
    limit: "1mb", // Prevent oversized payloads
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
