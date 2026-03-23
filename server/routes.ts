import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertJobSchema,
  insertApplicationSchema,
  insertInterviewSchema,
  insertTeamInviteSchema,
  users,
  jobs,
  applications,
  candidateProfiles,
} from "@shared/schema";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: JWT Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is required in production!");
    process.exit(1);
  }
  console.warn("⚠️  WARNING: Using default JWT_SECRET — set JWT_SECRET env var for production!");
  return "hiregenie-dev-secret-DO-NOT-USE-IN-PROD";
})();

const JWT_EXPIRY = "24h"; // Reduced from 7d to 24h

// ─── AI client ──────────────────────────────────────────────────────────────
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
let anthropic: Anthropic | null = null;
if (hasAnthropicKey) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Rate Limiters
// ═══════════════════════════════════════════════════════════════════════════════

// Auth routes: 5 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
});

// Registration: 3 per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
});

// AI endpoints: 10 per minute per user (handled per-token below)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "AI rate limit exceeded. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user token, falling back to IP
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
        return `user-${decoded.id}`;
      } catch { /* fallback to IP */ }
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  },
});

// General API: 100 per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Zod Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════════

const loginSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100).trim(),
  role: z.enum(["candidate", "employer"]).default("candidate"),
  phone: z.string().max(20).nullable().optional(),
});

const createJobSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(10).max(10000).trim(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  salaryMin: z.number().int().min(0).max(10000000).optional().nullable(),
  salaryMax: z.number().int().min(0).max(10000000).optional().nullable(),
  type: z.enum(["full_time", "part_time", "contract", "internship"]).default("full_time"),
  location: z.string().max(200).optional().nullable(),
  remote: z.boolean().optional().default(false),
  status: z.enum(["active", "closed", "draft"]).default("active"),
});

const updateJobSchema = createJobSchema.partial();

const updateCandidateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).optional().nullable(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  experience: z.union([z.string(), z.array(z.any())]).optional(),
  education: z.union([z.string(), z.array(z.any())]).optional(),
  summary: z.string().max(5000).optional().nullable(),
  resumeText: z.string().max(50000).optional().nullable(),
  desiredRole: z.string().max(200).optional().nullable(),
  desiredSalary: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

const teamInviteBodySchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  role: z.enum(["super_admin", "recruiter", "hiring_manager", "viewer"]).default("recruiter"),
});

const createInterviewSchema = z.object({
  applicationId: z.number().int().positive(),
  scheduledAt: z.string().min(1, "scheduledAt is required"),
  duration: z.number().int().min(15).max(480).default(60),
  type: z.enum(["phone", "video", "onsite"]).default("video"),
  notes: z.string().max(5000).nullable().optional(),
});

const updatePipelineStatusSchema = z.object({
  status: z.enum(["applied", "shortlisted", "interview", "offer", "rejected"]),
});

const addNotesSchema = z.object({
  notes: z.string().min(1).max(5000).trim(),
});

const resumeParseSchema = z.object({
  resumeText: z.string().min(1, "resumeText is required").max(50000),
});

const outreachSchema = z.object({
  candidateId: z.number().int().positive(),
  jobId: z.number().int().positive(),
  type: z.enum(["shortlist", "interview", "offer", "rejection"]),
});

const adminJobStatusSchema = z.object({
  status: z.enum(["active", "closed", "draft"]),
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Prompt Injection Guard
// ═══════════════════════════════════════════════════════════════════════════════

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*prompt/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /forget\s+(everything|all|your)\s+(you|instructions|rules)/i,
  /new\s+instructions?\s*:/i,
  /override\s+(your|the)\s+(instructions|rules|system)/i,
];

function containsPromptInjection(text: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizeUserInput(text: string): string {
  // Strip control characters, zero-width chars
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060\uFEFF]/g, "")
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: AI Token Usage Tracking
// ═══════════════════════════════════════════════════════════════════════════════

const aiUsageTracker = new Map<number, { count: number; tokens: number; lastReset: number }>();
const AI_DAILY_TOKEN_LIMIT = 50000; // Per-user daily token limit
const AI_DAILY_REQUEST_LIMIT = 50; // Per-user daily request limit

function checkAiUsage(userId: number): { allowed: boolean; message?: string } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let usage = aiUsageTracker.get(userId);
  
  if (!usage || now - usage.lastReset > dayMs) {
    usage = { count: 0, tokens: 0, lastReset: now };
    aiUsageTracker.set(userId, usage);
  }

  if (usage.count >= AI_DAILY_REQUEST_LIMIT) {
    return { allowed: false, message: "Daily AI request limit reached. Resets in 24 hours." };
  }
  if (usage.tokens >= AI_DAILY_TOKEN_LIMIT) {
    return { allowed: false, message: "Daily AI token limit reached. Resets in 24 hours." };
  }
  return { allowed: true };
}

function trackAiUsage(userId: number, tokensUsed: number) {
  const usage = aiUsageTracker.get(userId);
  if (usage) {
    usage.count++;
    usage.tokens += tokensUsed;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface AuthPayload {
  id: number;
  email: string;
  role: string;
}

interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Auth & RBAC Middleware
// ═══════════════════════════════════════════════════════════════════════════════

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function employerMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "employer") {
    return res.status(403).json({ message: "Employer access required" });
  }
  next();
}

// SECURITY FIX: Candidate-specific middleware (was missing — any authed user could hit candidate routes)
function candidateMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "candidate") {
    return res.status(403).json({ message: "Candidate access required" });
  }
  next();
}

function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: JWT_EXPIRY });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Validation helper
// ═══════════════════════════════════════════════════════════════════════════════

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    return { success: false, error: errors };
  }
  return { success: true, data: result.data };
}

// ─── AI helpers ─────────────────────────────────────────────────────────────
async function callClaude(systemPrompt: string, userPrompt: string): Promise<{ text: string | null; tokensUsed: number }> {
  if (!anthropic) return { text: null, tokensUsed: 0 };
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content[0];
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    return { text: block.type === "text" ? block.text : null, tokensUsed };
  } catch {
    return { text: null, tokensUsed: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Employer data-level access control helper
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyEmployerOwnsJob(userId: number, jobId: number): Promise<boolean> {
  const profile = await storage.getEmployerProfile(userId);
  if (!profile) return false;
  const job = await storage.getJob(jobId);
  if (!job) return false;
  return job.companyId === profile.companyId;
}

async function verifyEmployerOwnsApplication(userId: number, applicationId: number): Promise<boolean> {
  const profile = await storage.getEmployerProfile(userId);
  if (!profile) return false;
  const application = await storage.getApplication(applicationId);
  if (!application) return false;
  const job = await storage.getJob(application.jobId);
  if (!job) return false;
  return job.companyId === profile.companyId;
}

// ─── Register All Routes ────────────────────────────────────────────────────
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Apply general rate limiter to all API routes
  app.use("/api/", generalLimiter);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES (rate limited)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    try {
      const validation = validateBody(registerSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }
      const { email, password, name, role, phone } = validation.data;

      // SECURITY: Don't allow self-registration as admin
      if ((req.body as any).role === "admin") {
        return res.status(403).json({ message: "Cannot self-register as admin" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        // SECURITY: Don't reveal whether email exists
        return res.status(400).json({ message: "Registration failed. Please check your details." });
      }

      const hashedPassword = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: role || "candidate",
        phone: phone || null,
      });

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json({ token, user: userWithoutPassword });
    } catch (error: any) {
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const validation = validateBody(loginSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }
      const { email, password } = validation.data;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // SECURITY: Generic message — don't reveal if email exists
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
    } catch (error: any) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB ROUTES (public read, authenticated write)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      const { search, type, location, remote } = req.query;
      const filters: any = {};
      if (search) filters.search = String(search).substring(0, 200); // Limit search length
      if (type) filters.type = String(type);
      if (location) filters.location = String(location).substring(0, 200);
      if (remote !== undefined) filters.remote = remote === "true";

      const jobsList = await storage.getJobs(Object.keys(filters).length > 0 ? filters : undefined);

      const jobsWithCompany = await Promise.all(
        jobsList.map(async (job) => {
          const company = await storage.getCompany(job.companyId);
          return { ...job, company };
        })
      );

      return res.json(jobsWithCompany);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid job ID" });

      const job = await storage.getJob(id);
      if (!job) return res.status(404).json({ message: "Job not found" });
      const company = await storage.getCompany(job.companyId);
      return res.json({ ...job, company });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get job" });
    }
  });

  app.post("/api/jobs", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(createJobSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Employer profile not found" });
      if (profile.role !== "super_admin" && profile.role !== "recruiter") {
        return res.status(403).json({ message: "Only super admins and recruiters can create jobs" });
      }

      const data = validation.data;
      const jobData = {
        ...data,
        companyId: profile.companyId,
        postedBy: req.user!.id,
        skills: typeof data.skills === "string" ? data.skills : JSON.stringify(data.skills || []),
      };

      const job = await storage.createJob(jobData);
      return res.status(201).json(job);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.id);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      const validation = validateBody(updateJobSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      // SECURITY: Verify employer owns this job
      const ownsJob = await verifyEmployerOwnsJob(req.user!.id, jobId);
      if (!ownsJob) return res.status(403).json({ message: "Access denied — this job belongs to another company" });

      const updateData = { ...validation.data } as any;
      if (updateData.skills && typeof updateData.skills !== "string") {
        updateData.skills = JSON.stringify(updateData.skills);
      }

      const job = await storage.updateJob(jobId, updateData);
      if (!job) return res.status(404).json({ message: "Job not found" });
      return res.json(job);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.id);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      // SECURITY: Verify employer owns this job
      const ownsJob = await verifyEmployerOwnsJob(req.user!.id, jobId);
      if (!ownsJob) return res.status(403).json({ message: "Access denied — this job belongs to another company" });

      await storage.deleteJob(jobId);
      return res.json({ message: "Job deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANDIDATE ROUTES — SECURITY: Now require candidate role
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/candidates/profile", authMiddleware, candidateMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getCandidateProfile(req.user!.id);
      const user = await storage.getUserById(req.user!.id);
      return res.json({ profile: profile || null, user: user ? { name: user.name, email: user.email, phone: user.phone } : null });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get profile" });
    }
  });

  app.put("/api/candidates/profile", authMiddleware, candidateMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(updateCandidateProfileSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const { name, phone, ...profileData } = validation.data;

      if (name || phone) {
        const updateData: any = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        await storage.updateUser(req.user!.id, updateData);
      }

      // Stringify JSON fields
      const jsonFields = ["skills", "experience", "education"] as const;
      const processedData: any = { ...profileData };
      for (const field of jsonFields) {
        if (processedData[field] && typeof processedData[field] !== "string") {
          processedData[field] = JSON.stringify(processedData[field]);
        }
      }

      const profile = await storage.upsertCandidateProfile({
        userId: req.user!.id,
        ...processedData,
      });

      // Calculate profile strength
      let strength = 0;
      if (processedData.skills || profile.skills) strength += 20;
      if (processedData.experience || profile.experience) strength += 20;
      if (processedData.education || profile.education) strength += 20;
      if (processedData.summary || profile.summary) strength += 15;
      if (processedData.resumeText || profile.resumeText) strength += 15;
      if (processedData.desiredRole || profile.desiredRole) strength += 5;
      if (processedData.location || profile.location) strength += 5;
      await storage.updateProfileStrength(req.user!.id, Math.min(strength, 100));

      return res.json(profile);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/candidates/apply/:jobId", authMiddleware, candidateMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });
      if (job.status !== "active") return res.status(400).json({ message: "This job is no longer accepting applications" });

      // Check for duplicate application
      const existing = await storage.getApplicationsByCandidate(req.user!.id);
      if (existing.some((a) => a.jobId === jobId)) {
        return res.status(400).json({ message: "Already applied to this job" });
      }

      const application = await storage.createApplication({
        jobId,
        candidateId: req.user!.id,
        status: "applied",
        notes: req.body?.notes ? String(req.body.notes).substring(0, 5000) : null,
      });

      return res.status(201).json(application);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to apply" });
    }
  });

  app.get("/api/candidates/applications", authMiddleware, candidateMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const apps = await storage.getApplicationsByCandidate(req.user!.id);
      const appsWithJobs = await Promise.all(
        apps.map(async (app) => {
          const job = await storage.getJob(app.jobId);
          const company = job ? await storage.getCompany(job.companyId) : null;
          return { ...app, job, company };
        })
      );
      return res.json(appsWithJobs);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get applications" });
    }
  });

  app.get("/api/candidates/stats", authMiddleware, candidateMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const apps = await storage.getApplicationsByCandidate(req.user!.id);
      const stats = {
        total: apps.length,
        applied: apps.filter((a) => a.status === "applied").length,
        shortlisted: apps.filter((a) => a.status === "shortlisted").length,
        interview: apps.filter((a) => a.status === "interview").length,
        offer: apps.filter((a) => a.status === "offer").length,
        rejected: apps.filter((a) => a.status === "rejected").length,
      };
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYER ROUTES — SECURITY: Data-level access control added
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/employer/company", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const company = await storage.getCompany(profile.companyId);
      return res.json(company);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get company" });
    }
  });

  app.put("/api/employer/company", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(updateCompanySchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      // SECURITY: Only super_admin can update company details
      if (profile.role !== "super_admin") {
        return res.status(403).json({ message: "Only company super admins can update company details" });
      }

      const company = await storage.updateCompany(profile.companyId, validation.data);
      return res.json(company);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.get("/api/employer/jobs", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const jobsList = await storage.getJobsByCompany(profile.companyId);

      const jobsWithCounts = await Promise.all(
        jobsList.map(async (job) => {
          const apps = await storage.getApplicationsByJob(job.id);
          return { ...job, applicationCount: apps.length };
        })
      );

      return res.json(jobsWithCounts);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.get("/api/employer/pipeline/:jobId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      // SECURITY: Verify employer owns this job
      const ownsJob = await verifyEmployerOwnsJob(req.user!.id, jobId);
      if (!ownsJob) return res.status(403).json({ message: "Access denied" });

      const apps = await storage.getApplicationsByJob(jobId);

      const pipeline = await Promise.all(
        apps.map(async (app) => {
          const candidate = await storage.getUserById(app.candidateId);
          const profile = await storage.getCandidateProfile(app.candidateId);
          const shortlistResults = await storage.getShortlistResults(jobId);
          const aiResult = shortlistResults.find((r) => r.candidateId === app.candidateId);
          return {
            ...app,
            candidate: candidate ? { id: candidate.id, name: candidate.name, email: candidate.email } : null,
            profile,
            aiScore: aiResult?.score || null,
            aiRecommendation: aiResult?.recommendation || null,
          };
        })
      );

      return res.json(pipeline);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get pipeline" });
    }
  });

  app.put("/api/employer/pipeline/:applicationId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const applicationId = Number(req.params.applicationId);
      if (!Number.isInteger(applicationId) || applicationId < 1) return res.status(400).json({ message: "Invalid application ID" });

      const validation = validateBody(updatePipelineStatusSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      // SECURITY: Verify employer owns this application's job
      const ownsApp = await verifyEmployerOwnsApplication(req.user!.id, applicationId);
      if (!ownsApp) return res.status(403).json({ message: "Access denied" });

      const application = await storage.updateApplicationStatus(applicationId, validation.data.status);
      if (!application) return res.status(404).json({ message: "Application not found" });
      return res.json(application);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update pipeline" });
    }
  });

  app.post("/api/employer/notes/:applicationId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const applicationId = Number(req.params.applicationId);
      if (!Number.isInteger(applicationId) || applicationId < 1) return res.status(400).json({ message: "Invalid application ID" });

      const validation = validateBody(addNotesSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      // SECURITY: Verify employer owns this application's job
      const ownsApp = await verifyEmployerOwnsApplication(req.user!.id, applicationId);
      if (!ownsApp) return res.status(403).json({ message: "Access denied" });

      const app = await storage.getApplication(applicationId);
      if (!app) return res.status(404).json({ message: "Application not found" });

      const existingNotes = app.notes ? app.notes : "";
      const updatedNotes = existingNotes
        ? `${existingNotes}\n---\n${new Date().toISOString()}: ${validation.data.notes}`
        : `${new Date().toISOString()}: ${validation.data.notes}`;

      const updated = await storage.updateApplicationStatus(app.id, app.status, updatedNotes);
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to add notes" });
    }
  });

  app.get("/api/employer/team", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const members = await storage.getTeamMembers(profile.companyId);
      const sanitizedMembers = members.map(({ user, ...rest }) => ({
        ...rest,
        user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
      }));
      const invites = await storage.getTeamInvites(profile.companyId);
      return res.json({ members: sanitizedMembers, invites });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get team" });
    }
  });

  app.post("/api/employer/team/invite", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(teamInviteBodySchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      // SECURITY: Only super_admin can invite team members
      if (profile.role !== "super_admin") {
        return res.status(403).json({ message: "Only company super admins can invite team members" });
      }

      const invite = await storage.createTeamInvite({
        companyId: profile.companyId,
        email: validation.data.email,
        role: validation.data.role,
        invitedBy: req.user!.id,
        status: "pending",
      });

      return res.status(201).json(invite);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to send invite" });
    }
  });

  app.get("/api/employer/analytics", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      const companyJobs = await storage.getJobsByCompany(profile.companyId);

      let totalApplications = 0;
      const statusCounts: Record<string, number> = {
        applied: 0,
        shortlisted: 0,
        interview: 0,
        offer: 0,
        rejected: 0,
      };

      for (const job of companyJobs) {
        const apps = await storage.getApplicationsByJob(job.id);
        totalApplications += apps.length;
        for (const app of apps) {
          statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
        }
      }

      return res.json({
        totalJobs: companyJobs.length,
        activeJobs: companyJobs.filter((j) => j.status === "active").length,
        totalApplications,
        applicationsByStatus: statusCounts,
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get analytics" });
    }
  });

  app.post("/api/employer/interviews", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(createInterviewSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const { applicationId, scheduledAt, duration, type, notes } = validation.data;

      // SECURITY: Verify employer owns this application
      const ownsApp = await verifyEmployerOwnsApplication(req.user!.id, applicationId);
      if (!ownsApp) return res.status(403).json({ message: "Access denied" });

      const application = await storage.getApplication(applicationId);
      if (!application) return res.status(404).json({ message: "Application not found" });

      // Update application status to interview
      await storage.updateApplicationStatus(applicationId, "interview");

      const interview = await storage.createInterview({
        applicationId,
        scheduledAt,
        duration: duration || 60,
        type: type || "video",
        notes: notes || null,
        status: "scheduled",
        feedback: null,
      });

      return res.status(201).json(interview);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to schedule interview" });
    }
  });

  app.get("/api/employer/interviews", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      const companyJobs = await storage.getJobsByCompany(profile.companyId);
      const allInterviews: any[] = [];

      for (const job of companyJobs) {
        const apps = await storage.getApplicationsByJob(job.id);
        for (const app of apps) {
          const interviewList = await storage.getInterviews({ applicationId: app.id });
          for (const interview of interviewList) {
            const candidate = await storage.getUserById(app.candidateId);
            allInterviews.push({
              ...interview,
              job: { id: job.id, title: job.title },
              candidate: candidate ? { id: candidate.id, name: candidate.name, email: candidate.email } : null,
            });
          }
        }
      }

      return res.json(allInterviews);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get interviews" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI ROUTES — SECURITY: Rate limited, prompt injection guarded, token tracked
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/ai/parse-resume", authMiddleware, candidateMiddleware, aiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(resumeParseSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const resumeText = sanitizeUserInput(validation.data.resumeText);

      // SECURITY: Check for prompt injection
      if (containsPromptInjection(resumeText)) {
        return res.status(400).json({ message: "Invalid input detected" });
      }

      // SECURITY: Check AI usage limits
      const usageCheck = checkAiUsage(req.user!.id);
      if (!usageCheck.allowed) {
        return res.status(429).json({ message: usageCheck.message });
      }

      const { text: result, tokensUsed } = await callClaude(
        "You are an AI resume parser. Extract structured data from the resume text. Return ONLY valid JSON with keys: skills (string array), experience (array of {title, company, duration, description}), education (array of {degree, institution, year}), summary (string). No markdown, no code fences.",
        resumeText
      );

      trackAiUsage(req.user!.id, tokensUsed);

      if (result) {
        try {
          const parsed = JSON.parse(result);
          return res.json(parsed);
        } catch { /* fall through to mock */ }
      }

      // Mock/demo response
      return res.json({
        skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL"],
        experience: [
          { title: "Software Engineer", company: "Tech Corp", duration: "2020-2023", description: "Full-stack development" },
          { title: "Junior Developer", company: "StartupXYZ", duration: "2018-2020", description: "Frontend development" },
        ],
        education: [
          { degree: "BS Computer Science", institution: "State University", year: "2018" },
        ],
        summary: "Experienced full-stack developer with expertise in modern web technologies. Strong background in JavaScript/TypeScript ecosystem with 5+ years of professional experience.",
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to parse resume" });
    }
  });

  app.post("/api/ai/match-jobs", authMiddleware, candidateMiddleware, aiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Check AI usage limits
      const usageCheck = checkAiUsage(req.user!.id);
      if (!usageCheck.allowed) {
        return res.status(429).json({ message: usageCheck.message });
      }

      const profile = await storage.getCandidateProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Complete your profile first" });

      const activeJobs = await storage.getJobs();

      const candidateData = {
        skills: profile.skills,
        experience: profile.experience,
        summary: profile.summary,
        desiredRole: profile.desiredRole,
        location: profile.location,
      };

      const jobSummaries = activeJobs.map((j) => ({
        id: j.id,
        title: j.title,
        skills: j.skills,
        description: j.description?.substring(0, 200),
        location: j.location,
        remote: j.remote,
      }));

      const { text: result, tokensUsed } = await callClaude(
        "You are a job matching AI. Score how well the candidate matches each job from 0-100. Return ONLY valid JSON: an array of {jobId: number, score: number, reasoning: string}. No markdown.",
        `Candidate: ${JSON.stringify(candidateData)}\n\nJobs: ${JSON.stringify(jobSummaries)}`
      );

      trackAiUsage(req.user!.id, tokensUsed);

      if (result) {
        try {
          const scores = JSON.parse(result);
          const matches = await Promise.all(
            scores.map(async (s: any) => {
              const job = activeJobs.find((j) => j.id === s.jobId);
              const company = job ? await storage.getCompany(job.companyId) : null;
              return { job: job ? { ...job, company } : null, score: s.score, reasoning: s.reasoning };
            })
          );
          matches.sort((a: any, b: any) => b.score - a.score);
          return res.json(matches.filter((m: any) => m.job));
        } catch { /* fall through to mock */ }
      }

      // Mock response
      const matches = await Promise.all(
        activeJobs.map(async (job) => {
          const company = await storage.getCompany(job.companyId);
          return {
            job: { ...job, company },
            score: Math.floor(Math.random() * 40) + 60,
            reasoning: "Good match based on skills and experience alignment.",
          };
        })
      );
      matches.sort((a, b) => b.score - a.score);
      return res.json(matches);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to match jobs" });
    }
  });

  app.post("/api/ai/shortlist/:jobId", authMiddleware, employerMiddleware, aiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      // SECURITY: Verify employer owns this job
      const ownsJob = await verifyEmployerOwnsJob(req.user!.id, jobId);
      if (!ownsJob) return res.status(403).json({ message: "Access denied" });

      // SECURITY: Check AI usage limits
      const usageCheck = checkAiUsage(req.user!.id);
      if (!usageCheck.allowed) {
        return res.status(429).json({ message: usageCheck.message });
      }

      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });

      const apps = await storage.getApplicationsByJob(jobId);
      if (apps.length === 0) return res.json([]);

      const candidateData = await Promise.all(
        apps.map(async (app) => {
          const user = await storage.getUserById(app.candidateId);
          const profile = await storage.getCandidateProfile(app.candidateId);
          return {
            candidateId: app.candidateId,
            name: user?.name,
            skills: profile?.skills,
            experience: profile?.experience,
            summary: profile?.summary,
          };
        })
      );

      const { text: aiResult, tokensUsed } = await callClaude(
        "You are a hiring AI. Rank candidates for the job. Return ONLY valid JSON: array of {candidateId: number, score: number (0-100), recommendation: string, strengths: string, concerns: string}. No markdown.",
        `Job: ${JSON.stringify({ title: job.title, description: job.description, skills: job.skills })}\n\nCandidates: ${JSON.stringify(candidateData)}`
      );

      trackAiUsage(req.user!.id, tokensUsed);

      let rankings: any[] | null = null;
      if (aiResult) {
        try { rankings = JSON.parse(aiResult); } catch { /* fall through */ }
      }

      if (rankings) {
        const savedResults = await Promise.all(
          rankings.map(async (r: any) => {
            return storage.saveShortlistResult({
              jobId,
              candidateId: r.candidateId,
              score: r.score,
              recommendation: r.recommendation,
              strengths: r.strengths,
              concerns: r.concerns,
            });
          })
        );
        savedResults.sort((a, b) => b.score - a.score);
        return res.json(savedResults);
      }

      // Mock response
      const results = await Promise.all(
        candidateData.map(async (c) => {
          const score = Math.floor(Math.random() * 40) + 60;
          const saved = await storage.saveShortlistResult({
            jobId,
            candidateId: c.candidateId,
            score,
            recommendation: score >= 80 ? "Strongly Recommended" : score >= 60 ? "Recommended" : "Consider",
            strengths: "Good technical skills and relevant experience",
            concerns: "Could benefit from more industry-specific experience",
          });
          return saved;
        })
      );
      results.sort((a, b) => b.score - a.score);
      return res.json(results);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to shortlist" });
    }
  });

  app.post("/api/ai/outreach", authMiddleware, employerMiddleware, aiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateBody(outreachSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const { candidateId, jobId, type } = validation.data;

      // SECURITY: Verify employer owns this job
      const ownsJob = await verifyEmployerOwnsJob(req.user!.id, jobId);
      if (!ownsJob) return res.status(403).json({ message: "Access denied" });

      // SECURITY: Check AI usage limits
      const usageCheck = checkAiUsage(req.user!.id);
      if (!usageCheck.allowed) {
        return res.status(429).json({ message: usageCheck.message });
      }

      const candidate = await storage.getUserById(candidateId);
      const job = await storage.getJob(jobId);
      const profile = await storage.getEmployerProfile(req.user!.id);
      const company = profile ? await storage.getCompany(profile.companyId) : null;

      if (!candidate || !job) {
        return res.status(404).json({ message: "Candidate or job not found" });
      }

      const { text: aiResult, tokensUsed } = await callClaude(
        `You are writing a professional ${type} email from ${company?.name || "the company"} to a job candidate. Return ONLY valid JSON with keys: subject (string), body (string). No markdown.`,
        `Candidate: ${candidate.name}\nJob: ${job.title}\nCompany: ${company?.name || "Our Company"}\nEmail type: ${type}`
      );

      trackAiUsage(req.user!.id, tokensUsed);

      if (aiResult) {
        try {
          const email = JSON.parse(aiResult);
          return res.json(email);
        } catch { /* fall through */ }
      }

      // Mock templates
      const templates: Record<string, { subject: string; body: string }> = {
        shortlist: {
          subject: `Great news! You've been shortlisted for ${job.title}`,
          body: `Dear ${candidate.name},\n\nWe're excited to let you know that you've been shortlisted for the ${job.title} position at ${company?.name || "our company"}.\n\nYour qualifications stood out among many applicants, and we'd love to move forward with your application.\n\nWe'll be in touch shortly with next steps.\n\nBest regards,\nThe Hiring Team`,
        },
        interview: {
          subject: `Interview Invitation: ${job.title} at ${company?.name || "Our Company"}`,
          body: `Dear ${candidate.name},\n\nCongratulations! We'd like to invite you for an interview for the ${job.title} position at ${company?.name || "our company"}.\n\nPlease let us know your availability for this week or next, and we'll schedule a time that works for both of us.\n\nLooking forward to speaking with you!\n\nBest regards,\nThe Hiring Team`,
        },
        offer: {
          subject: `Job Offer: ${job.title} at ${company?.name || "Our Company"}`,
          body: `Dear ${candidate.name},\n\nWe are thrilled to extend a formal job offer for the ${job.title} position at ${company?.name || "our company"}.\n\nWe were very impressed with your skills and experience throughout the interview process, and we believe you'll be a great addition to our team.\n\nPlease review the attached offer details and let us know if you have any questions.\n\nBest regards,\nThe Hiring Team`,
        },
        rejection: {
          subject: `Update on your application for ${job.title}`,
          body: `Dear ${candidate.name},\n\nThank you for your interest in the ${job.title} position at ${company?.name || "our company"} and for taking the time to apply.\n\nAfter careful consideration, we've decided to move forward with other candidates whose experience more closely aligns with our current needs.\n\nWe encourage you to apply for future openings that match your skills and experience.\n\nWishing you the best in your job search.\n\nBest regards,\nThe Hiring Team`,
        },
      };
      return res.json(templates[type] || templates.shortlist);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to generate outreach" });
    }
  });

  app.post("/api/ai/skill-gap", authMiddleware, candidateMiddleware, aiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Check AI usage limits
      const usageCheck = checkAiUsage(req.user!.id);
      if (!usageCheck.allowed) {
        return res.status(429).json({ message: usageCheck.message });
      }

      const profile = await storage.getCandidateProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Complete your profile first" });

      const { text: aiResult, tokensUsed } = await callClaude(
        "You are a career advisor AI. Analyze the candidate's skills and identify gaps for their desired role. Return ONLY valid JSON: {currentSkills: string[], gaps: [{skill: string, importance: 'High'|'Medium'|'Low', recommendation: string}], overallAssessment: string, recommendedPath: string}. No markdown.",
        `Profile: ${JSON.stringify({
          skills: profile.skills,
          experience: profile.experience,
          desiredRole: profile.desiredRole,
          summary: profile.summary,
        })}`
      );

      trackAiUsage(req.user!.id, tokensUsed);

      if (aiResult) {
        try {
          const analysis = JSON.parse(aiResult);
          return res.json(analysis);
        } catch { /* fall through */ }
      }

      // Mock response
      return res.json({
        currentSkills: profile.skills ? JSON.parse(profile.skills) : [],
        gaps: [
          { skill: "Cloud Architecture (AWS/GCP)", importance: "High", recommendation: "Take AWS Solutions Architect certification course" },
          { skill: "System Design", importance: "High", recommendation: "Practice system design problems on educative.io" },
          { skill: "GraphQL", importance: "Medium", recommendation: "Build a project using Apollo Server and Client" },
          { skill: "Docker & Kubernetes", importance: "Medium", recommendation: "Complete Docker Mastery course and practice K8s deployments" },
        ],
        overallAssessment: "Strong foundation in core web technologies. Focus on cloud infrastructure and system design to advance to senior roles.",
        recommendedPath: "Senior Full-Stack Engineer → Staff Engineer",
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to analyze skill gaps" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/stats", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const stats = await storage.getStats();
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get stats" });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100); // Cap at 100
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const allUsers = await storage.getAllUsers(limit, offset);
      const usersWithoutPasswords = allUsers.map(({ password, ...u }) => u);
      return res.json(usersWithoutPasswords);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid user ID" });
      if (id === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      await storage.deleteUser(id);
      return res.json({ message: "User deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/companies", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const allCompanies = await storage.getCompanies();
      return res.json(allCompanies);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get companies" });
    }
  });

  app.get("/api/admin/jobs", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const allJobs = await storage.getJobs();
      const jobsWithCompany = await Promise.all(
        allJobs.map(async (job) => {
          const company = await storage.getCompany(job.companyId);
          const apps = await storage.getApplicationsByJob(job.id);
          return { ...job, company, applicationCount: apps.length };
        })
      );
      return res.json(jobsWithCompany);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.put("/api/admin/jobs/:id/status", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.id);
      if (!Number.isInteger(jobId) || jobId < 1) return res.status(400).json({ message: "Invalid job ID" });

      const validation = validateBody(adminJobStatusSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error });
      }

      const job = await storage.updateJob(jobId, { status: validation.data.status });
      if (!job) return res.status(404).json({ message: "Job not found" });
      return res.json(job);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update job status" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEED DATA
  // ═══════════════════════════════════════════════════════════════════════════

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  // Only seed if users table is empty
  const existingUsers = await storage.getAllUsers(1, 0);
  if (existingUsers.length > 0) return;

  console.log("Seeding database with demo data...");

  // Admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await storage.createUser({
    email: "admin@hiregenie.com",
    password: adminPassword,
    name: "Admin User",
    role: "admin",
    phone: "+1-555-0100",
  });

  // Employer user
  const employerPassword = await bcrypt.hash("employer123", 12);
  const employer = await storage.createUser({
    email: "employer@hiregenie.com",
    password: employerPassword,
    name: "Sarah Chen",
    role: "employer",
    phone: "+1-555-0200",
  });

  // Company
  const company = await storage.createCompany({
    name: "TechVista Solutions",
    description: "A leading technology company specializing in AI-powered enterprise solutions. We build cutting-edge software that transforms how businesses operate.",
    industry: "Technology",
    website: "https://techvista.example.com",
    logo: null,
    size: "50-200",
    location: "San Francisco, CA",
  });

  // Employer profile
  await storage.createEmployerProfile({
    userId: employer.id,
    companyId: company.id,
    role: "super_admin",
    title: "Head of Talent Acquisition",
  });

  // Candidate user
  const candidatePassword = await bcrypt.hash("candidate123", 12);
  const candidate = await storage.createUser({
    email: "candidate@hiregenie.com",
    password: candidatePassword,
    name: "Alex Rivera",
    role: "candidate",
    phone: "+1-555-0300",
  });

  // Candidate profile
  await storage.upsertCandidateProfile({
    userId: candidate.id,
    skills: JSON.stringify(["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL"]),
    experience: JSON.stringify([
      { title: "Senior Frontend Engineer", company: "DataFlow Inc.", duration: "2021-2024", description: "Led frontend architecture for a real-time analytics dashboard serving 50k+ users" },
      { title: "Full Stack Developer", company: "CloudNine Startup", duration: "2019-2021", description: "Built microservices and React SPAs for a SaaS platform" },
      { title: "Junior Developer", company: "WebWorks Agency", duration: "2017-2019", description: "Developed responsive websites and web applications for various clients" },
    ]),
    education: JSON.stringify([
      { degree: "BS Computer Science", institution: "UC Berkeley", year: "2017" },
    ]),
    summary: "Senior full-stack engineer with 7+ years of experience building scalable web applications. Passionate about clean architecture, performance optimization, and mentoring junior developers.",
    resumeText: "Experienced software engineer specializing in modern web technologies...",
    profileStrength: 85,
    desiredRole: "Staff Engineer",
    desiredSalary: "$180,000 - $220,000",
    location: "San Francisco, CA",
  });

  // Sample jobs
  const job1 = await storage.createJob({
    companyId: company.id,
    postedBy: employer.id,
    title: "Senior Full-Stack Engineer",
    description: "We're looking for a Senior Full-Stack Engineer to join our core platform team. You'll be building AI-powered features that help enterprises automate complex workflows.\n\nResponsibilities:\n- Design and implement scalable backend services using Node.js and TypeScript\n- Build responsive and performant React frontends\n- Collaborate with ML engineers to integrate AI models\n- Mentor junior engineers and contribute to architectural decisions\n- Participate in code reviews and technical design discussions",
    skills: JSON.stringify(["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker"]),
    salaryMin: 150000,
    salaryMax: 200000,
    type: "full_time",
    location: "San Francisco, CA",
    remote: true,
    status: "active",
  });

  const job2 = await storage.createJob({
    companyId: company.id,
    postedBy: employer.id,
    title: "ML Engineer",
    description: "Join our AI team to build and deploy machine learning models that power our product recommendations and automation features.\n\nResponsibilities:\n- Develop and train ML models for natural language processing and recommendation systems\n- Build data pipelines for model training and inference\n- Optimize model performance and latency\n- Collaborate with product and engineering teams",
    skills: JSON.stringify(["Python", "PyTorch", "TensorFlow", "MLOps", "AWS SageMaker", "SQL"]),
    salaryMin: 160000,
    salaryMax: 220000,
    type: "full_time",
    location: "San Francisco, CA",
    remote: true,
    status: "active",
  });

  const job3 = await storage.createJob({
    companyId: company.id,
    postedBy: employer.id,
    title: "Product Designer",
    description: "We need a talented Product Designer to craft intuitive experiences for our enterprise platform.\n\nResponsibilities:\n- Lead end-to-end design for new product features\n- Create wireframes, prototypes, and high-fidelity mockups\n- Conduct user research and usability testing\n- Work closely with engineers to ensure design quality in implementation",
    skills: JSON.stringify(["Figma", "UI/UX Design", "Design Systems", "User Research", "Prototyping"]),
    salaryMin: 130000,
    salaryMax: 170000,
    type: "full_time",
    location: "New York, NY",
    remote: false,
    status: "active",
  });

  const job4 = await storage.createJob({
    companyId: company.id,
    postedBy: employer.id,
    title: "DevOps Engineer (Contract)",
    description: "Short-term contract to help us migrate our infrastructure to Kubernetes and set up CI/CD pipelines.\n\nResponsibilities:\n- Migrate existing Docker Compose deployments to Kubernetes\n- Set up GitOps workflows with ArgoCD\n- Implement monitoring and alerting with Prometheus/Grafana\n- Document infrastructure and runbooks",
    skills: JSON.stringify(["Kubernetes", "Docker", "Terraform", "AWS", "CI/CD", "Prometheus"]),
    salaryMin: 80,
    salaryMax: 120,
    type: "contract",
    location: "Remote",
    remote: true,
    status: "active",
  });

  // Sample applications
  await storage.createApplication({
    jobId: job1.id,
    candidateId: candidate.id,
    status: "shortlisted",
    notes: null,
  });

  await storage.createApplication({
    jobId: job2.id,
    candidateId: candidate.id,
    status: "applied",
    notes: null,
  });

  console.log("Database seeded successfully!");
}
