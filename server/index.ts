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

// ─── Security: CORS ────────────────────────────────────────────────────────
// Allow same-origin (no Origin header), known hosting platforms, and
// any additional origins configured via ALLOWED_ORIGINS env var.
// When self-hosting on your own domain, set ALLOWED_ORIGINS=https://yourdomain.com
const EXTRA_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

function isAllowedOrigin(origin: string): boolean {
  // Localhost variants (dev)
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://0.0.0.0:")) {
    return true;
  }
  // Perplexity hosting (deployed sites run in iframes on these domains)
  if (origin.includes(".pplx.app") || origin.includes(".perplexity.ai")) {
    return true;
  }
  // User-configured production origins
  if (EXTRA_ORIGINS.includes(origin)) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = same-origin request, mobile app, or server-to-server
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      // In development, allow everything
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      console.warn(`CORS blocked origin: ${origin}`);
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
