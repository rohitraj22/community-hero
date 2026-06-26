# Community Hero 🦸🏽‍♀️🦸🏽‍♂️

**Live Deployment:** [https://community-hero-831432677522.us-central1.run.app](https://community-hero-831432677522.us-central1.run.app)

Community Hero is a modern, interactive web application empowering citizens to report, track, and resolve local civic issues. By crowdsourcing problem reporting—like potholes, broken streetlights, or waste management issues—Community Hero bridges the gap between residents and local authorities, fostering a cleaner, safer, and more engaged community.

---

## 🎯 Problem Statement Selected

Urban and suburban communities often struggle with maintaining civic infrastructure. Residents frequently notice issues (like severe road degradation, overflowing garbage, or broken utilities) but lack a streamlined, transparent way to report them to the responsible authorities. Traditional reporting methods are often opaque, leaving citizens wondering if their voice was heard. This leads to civic disengagement and prolonged infrastructure problems.

## 💡 Solution Overview

Community Hero provides a centralized, map-based platform where users can drop a pin on a specific location and report an issue with details and severity. The platform aggregates these reports, categorizes them, and displays them on an interactive dashboard. 

Key aspects of the solution:
- **Transparency:** All reported issues are visible to the community.
- **Prioritization:** Community members can "upvote" or engage with issues, helping authorities prioritize the most pressing problems.
- **Status Tracking:** Issues have clear lifecycle statuses (`Reported`, `Verified`, `In-Progress`, `Resolved`), providing a feedback loop to the reporters.

## ✨ Key Features

- **Interactive Map Dashboard:** A responsive, full-screen map interface (powered by Leaflet) displaying all community reports as interactive markers.
- **Precise Location Reporting:** Users can click anywhere on the map to pinpoint an issue. The app uses reverse geocoding to automatically determine the City, State, and Pincode.
- **Issue Feed & Filtering:** A glassmorphic side panel listing all issues with powerful filtering (by category, status, date range) and sorting capabilities (by date, severity, engagement, or escalation level).
- **Community Engagement:** Users can upvote issues to increase their visibility and engagement score.
- **Escalation System:** A built-in scoring system that highlights critical issues based on severity and community engagement.

## 🛠 Technologies Used

- **Frontend Framework:** Next.js (React)
- **Styling:** Tailwind CSS (with custom glassmorphism and modern UI design)
- **Database:** Firebase Firestore (NoSQL Document Database)
- **Maps:** Leaflet & React-Leaflet
- **Icons:** Lucide React

## ☁️ Google Technologies Utilized

- **Google Cloud Run:** The application is containerized and deployed on Google Cloud Run for scalable, serverless execution.
- **Google Cloud Build:** Used for CI/CD to automatically build Docker images.
- **Google Artifact Registry:** Stores the built Docker images for deployment.
- **Gemini API:** Integrated for advanced AI capabilities (e.g., smart categorization or analysis of reports).

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v20+)
- Firebase Project Setup
- Google Cloud Project Setup

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/community-hero.git
   cd community-hero
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory and add your keys:
   ```env
   GEMINI_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
