import {
  type User, type InsertUser, users,
  type CandidateProfile, type InsertCandidateProfile, candidateProfiles,
  type Company, type InsertCompany, companies,
  type EmployerProfile, type InsertEmployerProfile, employerProfiles,
  type Job, type InsertJob, jobs,
  type Application, type InsertApplication, applications,
  type AiShortlistResult, type InsertAiShortlistResult, aiShortlistResults,
  type Interview, type InsertInterview, interviews,
  type TeamInvite, type InsertTeamInvite, teamInvites,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, like, or, sql, count } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'candidate',
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS candidate_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    skills TEXT,
    experience TEXT,
    education TEXT,
    summary TEXT,
    resume_text TEXT,
    profile_strength INTEGER DEFAULT 0,
    desired_role TEXT,
    desired_salary TEXT,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    industry TEXT,
    website TEXT,
    logo TEXT,
    size TEXT,
    location TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    role TEXT NOT NULL DEFAULT 'recruiter',
    title TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    posted_by INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    skills TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    type TEXT NOT NULL DEFAULT 'full_time',
    location TEXT,
    remote INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    candidate_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'applied',
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_shortlist_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    candidate_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL,
    recommendation TEXT,
    strengths TEXT,
    concerns TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    scheduled_at TEXT NOT NULL,
    duration INTEGER DEFAULT 60,
    type TEXT NOT NULL DEFAULT 'video',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    feedback TEXT
  );

  CREATE TABLE IF NOT EXISTS team_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'recruiter',
    invited_by INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Auth
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;

  // Candidate
  getCandidateProfile(userId: number): Promise<CandidateProfile | undefined>;
  upsertCandidateProfile(profile: InsertCandidateProfile): Promise<CandidateProfile>;
  updateProfileStrength(userId: number, strength: number): Promise<void>;

  // Company
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: number): Promise<Company | undefined>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;

  // Employer
  createEmployerProfile(profile: InsertEmployerProfile): Promise<EmployerProfile>;
  getEmployerProfile(userId: number): Promise<EmployerProfile | undefined>;
  getTeamMembers(companyId: number): Promise<(EmployerProfile & { user?: User })[]>;

  // Jobs
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getJobs(filters?: { search?: string; type?: string; location?: string; remote?: boolean }): Promise<Job[]>;
  getJobsByCompany(companyId: number): Promise<Job[]>;
  updateJob(id: number, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: number): Promise<void>;

  // Applications
  createApplication(application: InsertApplication): Promise<Application>;
  getApplication(id: number): Promise<Application | undefined>;
  getApplicationsByJob(jobId: number): Promise<Application[]>;
  getApplicationsByCandidate(candidateId: number): Promise<Application[]>;
  updateApplicationStatus(id: number, status: string, notes?: string): Promise<Application | undefined>;

  // AI Results
  saveShortlistResult(result: InsertAiShortlistResult): Promise<AiShortlistResult>;
  getShortlistResults(jobId: number): Promise<AiShortlistResult[]>;

  // Interviews
  createInterview(interview: InsertInterview): Promise<Interview>;
  getInterviews(filters?: { applicationId?: number }): Promise<Interview[]>;
  updateInterview(id: number, data: Partial<InsertInterview>): Promise<Interview | undefined>;

  // Team
  createTeamInvite(invite: InsertTeamInvite): Promise<TeamInvite>;
  getTeamInvites(companyId: number): Promise<TeamInvite[]>;
  updateTeamInvite(id: number, status: string): Promise<TeamInvite | undefined>;

  // Admin
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  getStats(): Promise<{ users: number; jobs: number; applications: number; companies: number }>;
}

export class DatabaseStorage implements IStorage {
  // ─── Auth ───────────────────────────────────────────────────────────────────
  async createUser(user: InsertUser): Promise<User> {
    return db.insert(users).values({ ...user, createdAt: new Date().toISOString() }).returning().get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  // ─── Candidate ──────────────────────────────────────────────────────────────
  async getCandidateProfile(userId: number): Promise<CandidateProfile | undefined> {
    return db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId)).get();
  }

  async upsertCandidateProfile(profile: InsertCandidateProfile): Promise<CandidateProfile> {
    const existing = await this.getCandidateProfile(profile.userId);
    if (existing) {
      return db.update(candidateProfiles).set(profile).where(eq(candidateProfiles.userId, profile.userId)).returning().get();
    }
    return db.insert(candidateProfiles).values(profile).returning().get();
  }

  async updateProfileStrength(userId: number, strength: number): Promise<void> {
    db.update(candidateProfiles).set({ profileStrength: strength }).where(eq(candidateProfiles.userId, userId)).run();
  }

  // ─── Company ────────────────────────────────────────────────────────────────
  async createCompany(company: InsertCompany): Promise<Company> {
    return db.insert(companies).values({ ...company, createdAt: new Date().toISOString() }).returning().get();
  }

  async getCompany(id: number): Promise<Company | undefined> {
    return db.select().from(companies).where(eq(companies.id, id)).get();
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    return db.update(companies).set(data).where(eq(companies.id, id)).returning().get();
  }

  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).all();
  }

  // ─── Employer ───────────────────────────────────────────────────────────────
  async createEmployerProfile(profile: InsertEmployerProfile): Promise<EmployerProfile> {
    return db.insert(employerProfiles).values(profile).returning().get();
  }

  async getEmployerProfile(userId: number): Promise<EmployerProfile | undefined> {
    return db.select().from(employerProfiles).where(eq(employerProfiles.userId, userId)).get();
  }

  async getTeamMembers(companyId: number): Promise<(EmployerProfile & { user?: User })[]> {
    const profiles = db.select().from(employerProfiles).where(eq(employerProfiles.companyId, companyId)).all();
    const result: (EmployerProfile & { user?: User })[] = [];
    for (const profile of profiles) {
      const user = db.select().from(users).where(eq(users.id, profile.userId)).get();
      result.push({ ...profile, user });
    }
    return result;
  }

  // ─── Jobs ───────────────────────────────────────────────────────────────────
  async createJob(job: InsertJob): Promise<Job> {
    return db.insert(jobs).values({ ...job, createdAt: new Date().toISOString() }).returning().get();
  }

  async getJob(id: number): Promise<Job | undefined> {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  async getJobs(filters?: { search?: string; type?: string; location?: string; remote?: boolean }): Promise<Job[]> {
    let query = db.select().from(jobs).where(eq(jobs.status, "active")).orderBy(desc(jobs.createdAt));

    if (filters) {
      const conditions = [eq(jobs.status, "active")];

      if (filters.type) {
        conditions.push(eq(jobs.type, filters.type as any));
      }
      if (filters.location) {
        conditions.push(like(jobs.location, `%${filters.location}%`));
      }
      if (filters.remote !== undefined) {
        conditions.push(eq(jobs.remote, filters.remote));
      }
      if (filters.search) {
        conditions.push(
          or(
            like(jobs.title, `%${filters.search}%`),
            like(jobs.description, `%${filters.search}%`)
          )!
        );
      }

      return db.select().from(jobs).where(and(...conditions)).orderBy(desc(jobs.createdAt)).all();
    }

    return query.all();
  }

  async getJobsByCompany(companyId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.companyId, companyId)).orderBy(desc(jobs.createdAt)).all();
  }

  async updateJob(id: number, data: Partial<InsertJob>): Promise<Job | undefined> {
    return db.update(jobs).set(data).where(eq(jobs.id, id)).returning().get();
  }

  async deleteJob(id: number): Promise<void> {
    db.delete(jobs).where(eq(jobs.id, id)).run();
  }

  // ─── Applications ──────────────────────────────────────────────────────────
  async createApplication(application: InsertApplication): Promise<Application> {
    return db.insert(applications).values({ ...application, appliedAt: new Date().toISOString() }).returning().get();
  }

  async getApplication(id: number): Promise<Application | undefined> {
    return db.select().from(applications).where(eq(applications.id, id)).get();
  }

  async getApplicationsByJob(jobId: number): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.jobId, jobId)).orderBy(desc(applications.appliedAt)).all();
  }

  async getApplicationsByCandidate(candidateId: number): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.candidateId, candidateId)).orderBy(desc(applications.appliedAt)).all();
  }

  async updateApplicationStatus(id: number, status: string, notes?: string): Promise<Application | undefined> {
    const updateData: Record<string, any> = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    return db.update(applications).set(updateData).where(eq(applications.id, id)).returning().get();
  }

  // ─── AI Results ─────────────────────────────────────────────────────────────
  async saveShortlistResult(result: InsertAiShortlistResult): Promise<AiShortlistResult> {
    return db.insert(aiShortlistResults).values({ ...result, createdAt: new Date().toISOString() }).returning().get();
  }

  async getShortlistResults(jobId: number): Promise<AiShortlistResult[]> {
    return db.select().from(aiShortlistResults).where(eq(aiShortlistResults.jobId, jobId)).orderBy(desc(aiShortlistResults.score)).all();
  }

  // ─── Interviews ─────────────────────────────────────────────────────────────
  async createInterview(interview: InsertInterview): Promise<Interview> {
    return db.insert(interviews).values(interview).returning().get();
  }

  async getInterviews(filters?: { applicationId?: number }): Promise<Interview[]> {
    if (filters?.applicationId) {
      return db.select().from(interviews).where(eq(interviews.applicationId, filters.applicationId)).orderBy(desc(interviews.scheduledAt)).all();
    }
    return db.select().from(interviews).orderBy(desc(interviews.scheduledAt)).all();
  }

  async updateInterview(id: number, data: Partial<InsertInterview>): Promise<Interview | undefined> {
    return db.update(interviews).set(data).where(eq(interviews.id, id)).returning().get();
  }

  // ─── Team ───────────────────────────────────────────────────────────────────
  async createTeamInvite(invite: InsertTeamInvite): Promise<TeamInvite> {
    return db.insert(teamInvites).values({ ...invite, createdAt: new Date().toISOString() }).returning().get();
  }

  async getTeamInvites(companyId: number): Promise<TeamInvite[]> {
    return db.select().from(teamInvites).where(eq(teamInvites.companyId, companyId)).orderBy(desc(teamInvites.createdAt)).all();
  }

  async updateTeamInvite(id: number, status: string): Promise<TeamInvite | undefined> {
    return db.update(teamInvites).set({ status: status as any }).where(eq(teamInvites.id, id)).returning().get();
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────
  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    return db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt)).all();
  }

  async deleteUser(id: number): Promise<void> {
    db.delete(candidateProfiles).where(eq(candidateProfiles.userId, id)).run();
    db.delete(employerProfiles).where(eq(employerProfiles.userId, id)).run();
    db.delete(users).where(eq(users.id, id)).run();
  }

  async getStats(): Promise<{ users: number; jobs: number; applications: number; companies: number }> {
    const [userCount] = db.select({ count: count() }).from(users).all();
    const [jobCount] = db.select({ count: count() }).from(jobs).all();
    const [appCount] = db.select({ count: count() }).from(applications).all();
    const [companyCount] = db.select({ count: count() }).from(companies).all();
    return {
      users: userCount.count,
      jobs: jobCount.count,
      applications: appCount.count,
      companies: companyCount.count,
    };
  }
}

export const storage = new DatabaseStorage();
