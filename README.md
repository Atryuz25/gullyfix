# GullyFix

**Civic reporting is solved. The fraud happens after.**

Ward offices in Indian cities systematically mark complaints "Resolved" without fixing them, just to hit internal KPI targets. Citizens have no recourse — until now. GullyFix is a civic accountability platform that makes ghost resolutions impossible by giving citizens the final word on whether an issue is actually fixed.

## What it does

GullyFix layers five autonomous AI agents on top of standard civic issue reporting:

1. **Closure Verification Agent** — Resolution claims open a citizen verification window instead of closing the ticket. Disputes trigger a multimodal three-way photo comparison (original report vs. officer's resolution claim vs. citizen's dispute evidence) to autonomously determine if the fix is real.
2. **Democratic Equity Engine** — Boosts priority scoring in historically under-resourced wards so municipal attention isn't captured only by the loudest, most connected neighborhoods.
3. **Vulnerable Corridor Multiplexer** — Detects proximity to hospitals, schools, and transit hubs and automatically halves SLA deadlines for high-risk locations.
4. **Department Accountability System** — Public reputation scores for municipal departments. Confirmed fraud results in automatic 180-day contract blacklisting below threshold.
5. **Verification Decay Engine** — Detects and neutralizes coordinated fake verification attempts using account age, trust score, and submission velocity.

## Pages

| Route | Description |
|---|---|
| `/landing` | Marketing entry point — problem statement, how it works, live impact stats |
| `/` | Live map dashboard — ward health, accountability index, issue list, layer toggles |
| `/report` | Three-step issue reporting flow with AI triage and voice-to-text |
| `/issue/[id]` | Issue detail — timeline, photo evidence, community verification, dispute flow |
| `/issue/[id]/trace` | Full AI reasoning trace for the agentic pipeline |
| `/stats` | Citywide accountability analytics |
| `/leaderboard` | Citizen XP rankings, global and per-ward |
| `/admin/ledger` | Municipal admin panel for issue status management |
| `/ward/[id]` | Department accountability profile with reputation tracking |
| `/profile` | Citizen stats, trust score, impact summary |

## Tech Stack

Next.js 14 (App Router) · React 19 · TypeScript · Vanilla CSS · Framer Motion · Firebase (Firestore, Auth) · Cloudinary · Google Maps JavaScript API 

## Google Technologies Utilized

- **Gemini 1.5 Flash:** Multimodal triage, dispute verification, equity/corridor reasoning.
- **Cloud Vision API:** Content moderation on user uploads.
- **Google Maps JavaScript API:** Live map rendering, marker clustering, heatmap and disputed-issue visualization layers.
- **Google Places API:** Vulnerable Corridor detection (identifying proximity to hospitals, schools, and transit hubs).
- **Firebase Firestore:** Real-time issue, user, and department state with live onSnapshot synchronization.
- **Firebase Authentication:** Google Sign-In for citizen and admin access.

## Running Locally

```bash
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev
```

## Deployment

**Live demo:** [https://gullyfixx.vercel.app](https://gullyfixx.vercel.app)

### Why Vercel?
While our entire backend infrastructure (Database, Authentication, Gemini AI, Cloud Vision, and Mapping) is natively built on **Google Cloud Services**, the Next.js frontend is deployed to **Vercel** rather than Google Cloud Run. 

This decision was made because Google Cloud currently requires a verified billing account (credit card) to provision the Cloud Functions/Cloud Run compute instances needed to execute Next.js dynamic API routes, even under the free tier. Vercel provides native Edge-compatible hosting for Next.js full-stack applications on their free tier with zero billing requirements, making it the optimal choice for rapid hackathon deployment while maintaining full integration with our Google Cloud backend.

---
*Built for the Community Hero — Hyperlocal Problem Solver hackathon challenge, 2026.*
