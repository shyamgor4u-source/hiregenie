# HireGenie Design Specification

## Design Direction — HRAI-Inspired Dark Theme

### Color Palette (HSL values for Tailwind/shadcn)
Inspired by HRAI Intelligence Platform: dark navy backgrounds, orange primary CTAs, purple secondary accents.

**Light Mode:**
- Background: `210 20% 98%` (soft blue-white)
- Foreground/text: `220 25% 10%`
- Card: `210 18% 96%`
- Card-foreground: `220 25% 10%`
- Border: `220 10% 88%`
- Primary (Orange): `25 95% 53%` (HRAI orange CTA)
- Primary-foreground: `0 0% 100%`
- Secondary: `220 14% 92%`
- Secondary-foreground: `220 25% 10%`
- Muted: `220 10% 93%`
- Muted-foreground: `220 10% 45%`
- Accent (Purple): `262 83% 58%`
- Accent-foreground: `0 0% 100%`
- Destructive: `0 84% 42%`
- Destructive-foreground: `0 0% 98%`
- Input: `220 10% 80%`
- Ring: `25 95% 53%`

**Dark Mode (Primary - matches HRAI):**
- Background: `222 28% 8%` (deep navy #1a1d27)
- Foreground: `210 20% 92%`
- Card: `222 24% 11%` (#1e2230)
- Card-foreground: `210 20% 92%`
- Border: `222 18% 18%`
- Primary (Orange): `25 95% 53%` (#f97316)
- Primary-foreground: `0 0% 100%`
- Secondary: `222 18% 16%`
- Secondary-foreground: `210 20% 92%`
- Muted: `222 14% 18%`
- Muted-foreground: `210 10% 55%`
- Accent (Purple): `262 83% 58%` (#8b5cf6)
- Accent-foreground: `0 0% 100%`
- Destructive: `0 72% 51%`
- Destructive-foreground: `0 0% 98%`

### Typography
- Font: Sora (display/headings) + DM Sans (body) — matching HRAI
- Loaded via Google Fonts CDN
- Uppercase letter-spaced labels for form fields

### Layout Patterns
- **Login page:** Split-screen (left marketing / right auth form) like HRAI
- **Dashboard pages:** Sidebar navigation (collapsible) + main content
- **Dark mode first** (default to dark)
- Cards with subtle borders, rounded corners (8-12px)
- Full-width orange CTAs with arrow →

### UI Components
- Buttons: Full-width rounded, orange primary, purple secondary
- Input fields: Dark bg, subtle border, uppercase labels
- Cards: Dark with subtle borders
- Badges/Pills: Outlined tag pills
- Stats boxes: Bold number + label
- Avatar: Rounded square with initial

## Features (Full Scope)

### Roles
1. **Candidate** — Job seekers
2. **Employer** — Company recruiters
3. **Admin** — Platform administrators

### Authentication
- Email + password registration/login
- JWT token-based auth
- Role-based access control
- Demo login: admin@hiregenie.com / admin123

### Candidate Features
- Profile builder (name, email, phone, skills, experience, education, resume text)
- AI resume parser (paste text → AI extracts structured data)
- AI-matched job recommendations with scores
- One-click job applications
- Application tracking (Applied → Shortlisted → Interview → Offer → Rejected)
- Skill gap analysis with AI insights

### Employer Features
- Company profile management
- Job posting (title, description, skills, salary range, type, location)
- Kanban-style candidate pipeline (5 stages)
- AI shortlisting with ranked recommendations
- AI outreach email generator (Shortlist/Interview/Offer/Rejection)
- Internal notes per candidate
- Interview scheduling
- Hiring analytics dashboard
- Team management with RBAC (Super Admin / Recruiter / Hiring Manager / Viewer)

### Admin Features
- Platform statistics (users, jobs, applications counts)
- User management (view + delete)
- Company overview
- Job moderation (activate/close)

### AI Features (Anthropic Claude)
1. Resume Parser — extract skills, experience, education from text
2. Job Matching — score candidates against jobs
3. Candidate Shortlisting — rank applicants with recommendations
4. Outreach Email Generator — 4 email types
5. Skill Gap Analysis — learning recommendations
