import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";
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

const JWT_SECRET = process.env.JWT_SECRET || "hiregenie-secret-key-2024";

// ─── AI client ──────────────────────────────────────────────────────────────
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
let anthropic: Anthropic | null = null;
if (hasAnthropicKey) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
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

function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// ─── AI helpers ─────────────────────────────────────────────────────────────
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}

// ─── Register All Routes ────────────────────────────────────────────────────
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, role, phone } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
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
      return res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      const { search, type, location, remote } = req.query;
      const filters: any = {};
      if (search) filters.search = String(search);
      if (type) filters.type = String(type);
      if (location) filters.location = String(location);
      if (remote !== undefined) filters.remote = remote === "true";

      const jobsList = await storage.getJobs(Object.keys(filters).length > 0 ? filters : undefined);

      // Attach company info
      const jobsWithCompany = await Promise.all(
        jobsList.map(async (job) => {
          const company = await storage.getCompany(job.companyId);
          return { ...job, company };
        })
      );

      return res.json(jobsWithCompany);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const job = await storage.getJob(Number(req.params.id));
      if (!job) return res.status(404).json({ message: "Job not found" });
      const company = await storage.getCompany(job.companyId);
      return res.json({ ...job, company });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get job" });
    }
  });

  app.post("/api/jobs", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Employer profile not found" });
      if (profile.role !== "super_admin" && profile.role !== "recruiter") {
        return res.status(403).json({ message: "Only super admins and recruiters can create jobs" });
      }

      const jobData = {
        ...req.body,
        companyId: profile.companyId,
        postedBy: req.user!.id,
        skills: typeof req.body.skills === "string" ? req.body.skills : JSON.stringify(req.body.skills || []),
      };

      const job = await storage.createJob(jobData);
      return res.status(201).json(job);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Employer profile not found" });

      const updateData = { ...req.body };
      if (updateData.skills && typeof updateData.skills !== "string") {
        updateData.skills = JSON.stringify(updateData.skills);
      }

      const job = await storage.updateJob(Number(req.params.id), updateData);
      if (!job) return res.status(404).json({ message: "Job not found" });
      return res.json(job);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteJob(Number(req.params.id));
      return res.json({ message: "Job deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to delete job" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANDIDATE ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/candidates/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getCandidateProfile(req.user!.id);
      const user = await storage.getUserById(req.user!.id);
      return res.json({ profile: profile || null, user: user ? { name: user.name, email: user.email, phone: user.phone } : null });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get profile" });
    }
  });

  app.put("/api/candidates/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { name, phone, ...profileData } = req.body;

      if (name || phone) {
        const updateData: any = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        await storage.updateUser(req.user!.id, updateData);
      }

      // Stringify JSON fields
      const jsonFields = ["skills", "experience", "education"];
      for (const field of jsonFields) {
        if (profileData[field] && typeof profileData[field] !== "string") {
          profileData[field] = JSON.stringify(profileData[field]);
        }
      }

      const profile = await storage.upsertCandidateProfile({
        userId: req.user!.id,
        ...profileData,
      });

      // Calculate profile strength
      let strength = 0;
      if (profileData.skills || profile.skills) strength += 20;
      if (profileData.experience || profile.experience) strength += 20;
      if (profileData.education || profile.education) strength += 20;
      if (profileData.summary || profile.summary) strength += 15;
      if (profileData.resumeText || profile.resumeText) strength += 15;
      if (profileData.desiredRole || profile.desiredRole) strength += 5;
      if (profileData.location || profile.location) strength += 5;
      await storage.updateProfileStrength(req.user!.id, Math.min(strength, 100));

      return res.json(profile);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.post("/api/candidates/apply/:jobId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });

      // Check for duplicate application
      const existing = await storage.getApplicationsByCandidate(req.user!.id);
      if (existing.some((a) => a.jobId === jobId)) {
        return res.status(400).json({ message: "Already applied to this job" });
      }

      const application = await storage.createApplication({
        jobId,
        candidateId: req.user!.id,
        status: "applied",
        notes: req.body?.notes || null,
      });

      return res.status(201).json(application);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to apply" });
    }
  });

  app.get("/api/candidates/applications", authMiddleware, async (req: AuthRequest, res: Response) => {
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
      return res.status(500).json({ message: error.message || "Failed to get applications" });
    }
  });

  app.get("/api/candidates/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
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
      return res.status(500).json({ message: error.message || "Failed to get stats" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYER ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/employer/company", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const company = await storage.getCompany(profile.companyId);
      return res.json(company);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get company" });
    }
  });

  app.put("/api/employer/company", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const company = await storage.updateCompany(profile.companyId, req.body);
      return res.json(company);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to update company" });
    }
  });

  app.get("/api/employer/jobs", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });
      const jobsList = await storage.getJobsByCompany(profile.companyId);

      // Add application counts
      const jobsWithCounts = await Promise.all(
        jobsList.map(async (job) => {
          const apps = await storage.getApplicationsByJob(job.id);
          return { ...job, applicationCount: apps.length };
        })
      );

      return res.json(jobsWithCounts);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get jobs" });
    }
  });

  app.get("/api/employer/pipeline/:jobId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
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
      return res.status(500).json({ message: error.message || "Failed to get pipeline" });
    }
  });

  app.put("/api/employer/pipeline/:applicationId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      const application = await storage.updateApplicationStatus(Number(req.params.applicationId), status);
      if (!application) return res.status(404).json({ message: "Application not found" });
      return res.json(application);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to update pipeline" });
    }
  });

  app.post("/api/employer/notes/:applicationId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { notes } = req.body;
      const app = await storage.getApplication(Number(req.params.applicationId));
      if (!app) return res.status(404).json({ message: "Application not found" });

      const existingNotes = app.notes ? app.notes : "";
      const updatedNotes = existingNotes
        ? `${existingNotes}\n---\n${new Date().toISOString()}: ${notes}`
        : `${new Date().toISOString()}: ${notes}`;

      const updated = await storage.updateApplicationStatus(app.id, app.status, updatedNotes);
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to add notes" });
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
      return res.status(500).json({ message: error.message || "Failed to get team" });
    }
  });

  app.post("/api/employer/team/invite", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      const { email, role } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const invite = await storage.createTeamInvite({
        companyId: profile.companyId,
        email,
        role: role || "recruiter",
        invitedBy: req.user!.id,
        status: "pending",
      });

      return res.status(201).json(invite);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to send invite" });
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
      return res.status(500).json({ message: error.message || "Failed to get analytics" });
    }
  });

  app.post("/api/employer/interviews", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { applicationId, scheduledAt, duration, type, notes } = req.body;
      if (!applicationId || !scheduledAt) {
        return res.status(400).json({ message: "applicationId and scheduledAt are required" });
      }

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
      return res.status(500).json({ message: error.message || "Failed to schedule interview" });
    }
  });

  app.get("/api/employer/interviews", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getEmployerProfile(req.user!.id);
      if (!profile) return res.status(404).json({ message: "Employer profile not found" });

      // Get all jobs for the company, then get interviews for those jobs' applications
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
      return res.status(500).json({ message: error.message || "Failed to get interviews" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/ai/parse-resume", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { resumeText } = req.body;
      if (!resumeText) return res.status(400).json({ message: "resumeText is required" });

      const result = await callClaude(
        "You are an AI resume parser. Extract structured data from the resume text. Return ONLY valid JSON with keys: skills (string array), experience (array of {title, company, duration, description}), education (array of {degree, institution, year}), summary (string). No markdown, no code fences.",
        resumeText
      );

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
      return res.status(500).json({ message: error.message || "Failed to parse resume" });
    }
  });

  app.post("/api/ai/match-jobs", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
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

      const result = await callClaude(
        "You are a job matching AI. Score how well the candidate matches each job from 0-100. Return ONLY valid JSON: an array of {jobId: number, score: number, reasoning: string}. No markdown.",
        `Candidate: ${JSON.stringify(candidateData)}\n\nJobs: ${JSON.stringify(jobSummaries)}`
      );

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
      return res.status(500).json({ message: error.message || "Failed to match jobs" });
    }
  });

  app.post("/api/ai/shortlist/:jobId", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = Number(req.params.jobId);
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

      const aiResult = await callClaude(
        "You are a hiring AI. Rank candidates for the job. Return ONLY valid JSON: array of {candidateId: number, score: number (0-100), recommendation: string, strengths: string, concerns: string}. No markdown.",
        `Job: ${JSON.stringify({ title: job.title, description: job.description, skills: job.skills })}\n\nCandidates: ${JSON.stringify(candidateData)}`
      );

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
      return res.status(500).json({ message: error.message || "Failed to shortlist" });
    }
  });

  app.post("/api/ai/outreach", authMiddleware, employerMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { candidateId, jobId, type } = req.body;
      if (!candidateId || !jobId || !type) {
        return res.status(400).json({ message: "candidateId, jobId, and type are required" });
      }

      const candidate = await storage.getUserById(candidateId);
      const job = await storage.getJob(jobId);
      const profile = await storage.getEmployerProfile(req.user!.id);
      const company = profile ? await storage.getCompany(profile.companyId) : null;

      if (!candidate || !job) {
        return res.status(404).json({ message: "Candidate or job not found" });
      }

      const aiResult = await callClaude(
        `You are writing a professional ${type} email from ${company?.name || "the company"} to a job candidate. Return ONLY valid JSON with keys: subject (string), body (string). No markdown.`,
        `Candidate: ${candidate.name}\nJob: ${job.title}\nCompany: ${company?.name || "Our Company"}\nEmail type: ${type}`
      );

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
      return res.status(500).json({ message: error.message || "Failed to generate outreach" });
    }
  });

  app.post("/api/ai/skill-gap", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getCandidateProfile(req.user!.id);
      if (!profile) return res.status(400).json({ message: "Complete your profile first" });

      const aiResult = await callClaude(
        "You are a career advisor AI. Analyze the candidate's skills and identify gaps for their desired role. Return ONLY valid JSON: {currentSkills: string[], gaps: [{skill: string, importance: 'High'|'Medium'|'Low', recommendation: string}], overallAssessment: string, recommendedPath: string}. No markdown.",
        `Profile: ${JSON.stringify({
          skills: profile.skills,
          experience: profile.experience,
          desiredRole: profile.desiredRole,
          summary: profile.summary,
        })}`
      );

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
      return res.status(500).json({ message: error.message || "Failed to analyze skill gaps" });
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
      return res.status(500).json({ message: error.message || "Failed to get stats" });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const allUsers = await storage.getAllUsers(limit, offset);
      const usersWithoutPasswords = allUsers.map(({ password, ...u }) => u);
      return res.json(usersWithoutPasswords);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get users" });
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      await storage.deleteUser(id);
      return res.json({ message: "User deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });

  app.get("/api/admin/companies", authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const allCompanies = await storage.getCompanies();
      return res.json(allCompanies);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to get companies" });
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
      return res.status(500).json({ message: error.message || "Failed to get jobs" });
    }
  });

  app.put("/api/admin/jobs/:id/status", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !["active", "closed", "draft"].includes(status)) {
        return res.status(400).json({ message: "Valid status required (active, closed, draft)" });
      }
      const job = await storage.updateJob(Number(req.params.id), { status });
      if (!job) return res.status(404).json({ message: "Job not found" });
      return res.json(job);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to update job status" });
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
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await storage.createUser({
    email: "admin@hiregenie.com",
    password: adminPassword,
    name: "Admin User",
    role: "admin",
    phone: "+1-555-0100",
  });

  // Employer user
  const employerPassword = await bcrypt.hash("employer123", 10);
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
  const candidatePassword = await bcrypt.hash("candidate123", 10);
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
