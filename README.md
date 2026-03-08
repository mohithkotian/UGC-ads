# UGC.AI

**AI-powered UGC video generator for modern product marketing.**

Upload your product and model images, describe your vision, and UGC.AI handles the rest — generating professional short-form videos ready for Instagram, TikTok, and YouTube.

Live at [ugc-ads-pink.vercel.app](https://ugc-ads-pink.vercel.app)

---

## What It Does

UGC.AI takes two inputs — a product image and a model image — and uses Google's latest AI models to first generate a professional product photo, then animate it into a 5-second video. The whole pipeline runs in the cloud, and results are available in your dashboard within minutes.

Users get a credit-based system with tiered plans, a community feed to browse other creators' work, and full control over whether their projects are public or private.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite 7 | Build tool |
| React Router DOM 7 | Client-side routing |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| Clerk React 5 | Authentication |
| Axios | HTTP client |
| Lenis | Smooth scrolling |
| React Hot Toast | Notifications |
| Lucide React | Icons |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express 5 | Server framework |
| TypeScript (TSX runtime) | Language |
| PostgreSQL + Prisma ORM | Database |
| Clerk Express | Auth middleware |
| Google Vertex AI | Imagen 3.0 + Veo 2.0 |
| Cloudinary | Image/video storage |
| Multer | File upload handling |
| Fluent FFmpeg | Video processing |
| Sentry | Error tracking |

---

## Project Structure

```
ugc-ai/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Landing page
│   │   │   ├── Generator.tsx       # Main generation interface
│   │   │   ├── MyGenerations.tsx   # User project dashboard
│   │   │   ├── Community.tsx       # Public project feed
│   │   │   ├── Plans.tsx           # Pricing and credits
│   │   │   ├── Result.tsx          # View generated output
│   │   │   └── Loading.tsx         # Generation loading state
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── UploadZone.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── Pricing.tsx
│   │   │   └── CreditsContext.tsx
│   │   └── main.tsx
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── user.ts       # Credits, projects, plan sync
    │   │   └── project.ts    # AI generation endpoints
    │   └── index.ts
    ├── prisma/
    │   └── schema.prisma
    └── package.json
```

---

## Database Schema

### User

```prisma
model User {
  id          String    @id @default(cuid())
  clerkId     String    @unique
  email       String    @unique
  name        String?
  image       String?
  plan        Plan      @default(FREE)
  usedCredits Int       @default(0)
  projects    Project[]
}
```

### Project

```prisma
model Project {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  name               String
  aspectRatio        String
  uploadedImages     String[]
  userPrompt         String
  productName        String
  productDescription String
  targetLength       Int      @default(5)
  status             String   @default("draft")
  isPublished        Boolean  @default(false)
  isGenerating       Boolean  @default(false)
  generatedImage     String?
  generatedVideo     String?
  error              String?
  createdAt          DateTime @default(now())
}
```

---

## API Reference

### User Routes — `/api/user`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/credits` | Required | Get remaining credits and current plan |
| POST | `/update-plan` | Required | Sync plan from Clerk subscription |
| GET | `/projects` | Required | Get all projects for the current user |
| GET | `/projects/:projectId` | Required | Get a single project by ID |
| GET | `/publish/:projectId` | Required | Toggle project public/private visibility |

### Project Routes — `/api/project`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/create` | Required | Create project and upload images (5 credits) |
| POST | `/video` | Required | Generate AI video for a project (10 credits) |
| GET | `/published` | Public | Fetch all published community projects |
| GET | `/:projectId` | Required | Get project details by ID |
| DELETE | `/:projectId` | Required | Delete a project |

---

## Credit System

| Plan | Monthly Credits | Image Generation | Video Generation |
|------|----------------|-----------------|-----------------|
| FREE | 20 | 5 credits | 10 credits |
| PRO | 80 | 5 credits | 10 credits |
| PREMIUM | 300 | 5 credits | 10 credits |

Credits are deducted at two points in the workflow: 5 credits when a project is created (image generation), and an additional 10 credits when the user requests video generation. Plans are synced in real-time from Clerk billing.

---

## AI Models

### Image Generation — Imagen 3.0

Google Vertex AI's Imagen model generates the base product photo. The prompt is composed from the product name, description, user's custom prompt, and lighting instructions. Output is always 1:1 aspect ratio.

### Video Generation — Veo 2.0

Veo takes the generated image as a starting frame and animates it into a 5-second video. Supports both 9:16 portrait (for Reels and TikTok) and 16:9 landscape (for YouTube). Generation is a long-running operation polled every 15 seconds, with a timeout after 40 attempts (~10 minutes).

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- Clerk account (for authentication and billing)
- Google Cloud project with Vertex AI enabled
- Cloudinary account (for media storage)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ugc-ai.git
cd ugc-ai
```

### 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
```

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_LOCATION=us-central1
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SENTRY_DSN=...
```

```bash
npx prisma migrate dev
npm run dev
```

### 3. Configure the frontend

```bash
cd frontend
npm install
cp .env.example .env.local
```

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:3000
```

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3000`.

---

## How It Works

```
User logs in via Clerk
  → Uploads product image + model image
  → Enters product name, description, and custom prompt
  → Selects aspect ratio (9:16 or 16:9)
  → Submits (5 credits deducted)
      → Imagen 3.0 generates a product photo
  → Requests video (10 credits deducted)
      → Veo 2.0 animates the image into a 5-second video
  → Result is saved to the dashboard
  → User can publish to the community feed or keep it private
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.


---


Built by [Mohith Kotian](https://github.com/mohithkotian)
