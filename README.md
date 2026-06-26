# Community Hero

**Live Application:** https://community-hero-831432677522.us-central1.run.app

Community Hero is a civic issue reporting and tracking platform that enables residents to report local infrastructure problems, monitor their status, and escalate them to the appropriate municipal authorities. The platform uses AI-powered image analysis to classify issues, assess severity, and automatically draft formal complaint letters addressed to the relevant government agencies.

---

## Problem Statement

Urban and suburban communities suffer from degraded civic infrastructure — potholes, broken streetlights, water leakages, and sanitation failures. Traditional reporting mechanisms are opaque, slow, and disconnected from the community. Residents have no way to verify whether their complaints were acknowledged, prioritize the most critical issues, or hold authorities accountable.

Community Hero solves this by providing a transparent, map-based civic intelligence platform where every reported issue is visible to the entire community, ranked by severity and community engagement, and automatically escalated to the correct municipal department via a formally drafted complaint letter.

---

## Solution Overview

The platform allows a user to click any location on an interactive map, upload a photograph of a civic issue, and have the AI agent analyze and classify the problem in seconds. The system then:

1. Classifies the issue type and assigns a severity score from 1.0 (minor) to 5.0 (critical).
2. Drafts a formal complaint letter addressed to the appropriate municipal executive engineer.
3. Stores the report in a real-time database visible to the entire community.
4. Allows other residents to upvote issues, comment, and track escalation status.
5. Dispatches the formal complaint as an email to the relevant authority.

---

## Key Features

### AI-Powered Issue Analysis
- Uses a 3-turn agentic pipeline powered by the Gemini API (`gemini-2.5-flash`) to inspect uploaded images.
- Turn 1 classifies the issue, determines category, and assigns a severity score with objective reasoning.
- Turn 2 routes the complaint to the appropriate municipal agency and drafts a formal complaint letter.
- Turn 3 generates citizen safety recommendations, a unique reference ID, and synthesizes the final report.

### Interactive Map Dashboard
- Full-screen map interface built with Leaflet and React-Leaflet, defaulting to Bangalore coordinates.
- Users click any location on the map to begin a report at that precise coordinate.
- Heatmap mode overlays issue density across the map for at-a-glance area analysis.
- Automatically reverse-geocodes map coordinates to a human-readable city, state, and pincode via the Nominatim API.

### Community Reports Feed
- Real-time feed of all reported issues, synchronized live with Firestore.
- Sorting: by date, severity, community engagement (upvotes + comments), or escalation score.
- Filtering: by issue category, escalation status, and a date range picker.
- Each issue card displays the severity rating, category badge, location, report date, upvote count, and comment count.

### Escalation Lifecycle
- Issues progress through four statuses: Reported, Verified, In-Progress, and Resolved.
- An escalation scoring algorithm factors in severity and community engagement to surface critical issues.
- A notification system alerts users to escalation changes and community activity on their reports.

### Formal Complaint Dispatch
- After an issue is analyzed and saved, users can dispatch the AI-drafted complaint letter as an HTML email to the relevant municipal authority using the Resend API.
- The email is addressed to the appropriate agency (e.g., BBMP for roads, BWSSB for water, BESCOM for electricity in Bangalore) and includes the reporter's name, address, coordinates, and a resolution timeline estimate.

### Gamified User System
- Users register with a name, email, and chosen avatar.
- Civic points are awarded for submitting reports and engaging with the platform.
- A six-tier badge progression system: Civic Rookie, Community Sentinel, Civic Defender, Municipal Master, Elite Guardian, and Community Hero.
- A leaderboard displays top contributors by overall points or weekly activity.

### User Profiles
- Each user has a profile showing their reported issues, earned badges, civic points, and location preference.
- Users can set a default map location, which becomes their starting view on every visit.
- Public profiles are viewable by clicking other users' names in the feed or leaderboard.

---

## Technologies Used

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | JavaScript (React) |
| Styling | Tailwind CSS |
| Database | Firebase Firestore |
| Authentication | Custom (localStorage-persisted, Firestore-backed) |
| Maps | Leaflet, React-Leaflet |
| Icons | Lucide React |
| Email Dispatch | Resend API |
| Reverse Geocoding | OpenStreetMap Nominatim |

---

## Google Technologies Utilized

| Technology | Usage |
|---|---|
| Gemini API (`gemini-2.5-flash`) | 3-turn agentic AI pipeline for image classification, severity assessment, municipal routing, and complaint drafting |
| Google Cloud Run | Serverless container hosting for the production application |
| Google Cloud Build | Automated Docker image build pipeline |
| Google Artifact Registry | Docker image storage and versioning |
| Firebase Firestore | Real-time NoSQL database for issues, users, and comments |
| Firebase Storage | Cloud storage for uploaded issue images |

---

## Architecture

```
User Browser
    |
    v
Next.js Application (Cloud Run)
    |
    |-- /app/page.js              Main dashboard, map, reports feed
    |-- /app/api/agent/route.js   Gemini agentic pipeline (3-turn chat)
    |-- /app/api/send-email/route.js  Resend email dispatch
    |
    |-- /components/
    |       ReportModal.js        Issue creation form with image upload
    |       InteractiveMap.js     Leaflet map with click-to-report
    |       AuthModal.js          User registration and login
    |       ProfileModal.js       Own profile view and editing
    |       UserProfileModal.js   Public profile view for other users
    |
    |-- /lib/firebase.js          Firestore client initialization
    |
Firebase Firestore (Real-time DB)
Gemini API (AI Analysis)
Resend API (Email Dispatch)
Nominatim API (Reverse Geocoding)
```

---

## Local Development Setup

### Prerequisites

- Node.js v20 or higher
- A Firebase project with Firestore enabled
- A Gemini API key
- A Resend API key (for email dispatch)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/rohitraj22/community-hero.git
cd community-hero
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Copy the example file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```env
GEMINI_API_KEY=your_gemini_api_key

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_TEST_RECIPIENT=your_email@example.com
```

**4. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment

The application is containerized with Docker and deployed to Google Cloud Run.

**Build and push the Docker image:**

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/community-hero/community-hero:latest \
  --region=us-central1 .
```

**Deploy to Cloud Run with environment variables:**

```bash
gcloud run deploy community-hero \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/community-hero/community-hero:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "GEMINI_API_KEY=...,NEXT_PUBLIC_FIREBASE_API_KEY=...,..."
```

---

## Project Structure

```
community-hero/
├── app/
│   ├── api/
│   │   ├── agent/route.js          Gemini 3-turn agentic analysis API
│   │   └── send-email/route.js     Resend email dispatch API
│   ├── global.css                  Global styles
│   ├── layout.js                   Root layout
│   └── page.js                     Main application page
├── components/
│   ├── AuthModal.js                User registration and login
│   ├── InteractiveMap.js           Leaflet map component
│   ├── ProfileModal.js             Profile editor
│   ├── ReportModal.js              Issue reporting form
│   └── UserProfileModal.js         Public user profile viewer
├── lib/
│   └── firebase.js                 Firebase client configuration
├── public/                         Static assets
├── .env.local.example              Environment variable template
├── Dockerfile                      Production container definition
├── package.json
└── tailwind.config.js
```

---

## License

This project was built for the Google Cloud x AI Hackathon. All rights reserved.
