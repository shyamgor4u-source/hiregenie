import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["candidate", "employer", "admin"] }).notNull().default("candidate"),
  phone: text("phone"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Candidate Profiles ─────────────────────────────────────────────────────
export const candidateProfiles = sqliteTable("candidate_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  skills: text("skills"), // JSON string array
  experience: text("experience"), // JSON string array
  education: text("education"), // JSON string array
  summary: text("summary"),
  resumeText: text("resume_text"),
  profileStrength: integer("profile_strength").default(0),
  desiredRole: text("desired_role"),
  desiredSalary: text("desired_salary"),
  location: text("location"),
});

export const insertCandidateProfileSchema = createInsertSchema(candidateProfiles).omit({ id: true });
export type InsertCandidateProfile = z.infer<typeof insertCandidateProfileSchema>;
export type CandidateProfile = typeof candidateProfiles.$inferSelect;

// ─── Companies ──────────────────────────────────────────────────────────────
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  industry: text("industry"),
  website: text("website"),
  logo: text("logo"),
  size: text("size"),
  location: text("location"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ─── Employer Profiles ──────────────────────────────────────────────────────
export const employerProfiles = sqliteTable("employer_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  role: text("role", { enum: ["super_admin", "recruiter", "hiring_manager", "viewer"] }).notNull().default("recruiter"),
  title: text("title"),
});

export const insertEmployerProfileSchema = createInsertSchema(employerProfiles).omit({ id: true });
export type InsertEmployerProfile = z.infer<typeof insertEmployerProfileSchema>;
export type EmployerProfile = typeof employerProfiles.$inferSelect;

// ─── Jobs ───────────────────────────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id),
  postedBy: integer("posted_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  skills: text("skills"), // JSON string array
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  type: text("type", { enum: ["full_time", "part_time", "contract", "internship"] }).notNull().default("full_time"),
  location: text("location"),
  remote: integer("remote", { mode: "boolean" }).default(false),
  status: text("status", { enum: ["active", "closed", "draft"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ─── Applications ───────────────────────────────────────────────────────────
export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  candidateId: integer("candidate_id").notNull().references(() => users.id),
  status: text("status", { enum: ["applied", "shortlisted", "interview", "offer", "rejected"] }).notNull().default("applied"),
  appliedAt: text("applied_at").notNull().default(new Date().toISOString()),
  notes: text("notes"),
});

export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, appliedAt: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;

// ─── AI Shortlist Results ───────────────────────────────────────────────────
export const aiShortlistResults = sqliteTable("ai_shortlist_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  candidateId: integer("candidate_id").notNull().references(() => users.id),
  score: integer("score").notNull(),
  recommendation: text("recommendation"),
  strengths: text("strengths"),
  concerns: text("concerns"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertAiShortlistResultSchema = createInsertSchema(aiShortlistResults).omit({ id: true, createdAt: true });
export type InsertAiShortlistResult = z.infer<typeof insertAiShortlistResultSchema>;
export type AiShortlistResult = typeof aiShortlistResults.$inferSelect;

// ─── Interviews ─────────────────────────────────────────────────────────────
export const interviews = sqliteTable("interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull().references(() => applications.id),
  scheduledAt: text("scheduled_at").notNull(),
  duration: integer("duration").default(60),
  type: text("type", { enum: ["phone", "video", "onsite"] }).notNull().default("video"),
  notes: text("notes"),
  status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull().default("scheduled"),
  feedback: text("feedback"),
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true });
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;

// ─── Team Invites ───────────────────────────────────────────────────────────
export const teamInvites = sqliteTable("team_invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id),
  email: text("email").notNull(),
  role: text("role", { enum: ["super_admin", "recruiter", "hiring_manager", "viewer"] }).notNull().default("recruiter"),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertTeamInviteSchema = createInsertSchema(teamInvites).omit({ id: true, createdAt: true });
export type InsertTeamInvite = z.infer<typeof insertTeamInviteSchema>;
export type TeamInvite = typeof teamInvites.$inferSelect;
