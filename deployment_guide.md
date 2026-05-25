# Collision App — Deployment & Feature Guide

This guide outlines the core features of the Collision application and provides step-by-step instructions to deploy this frontend client live to the public domain for free.

---

## 🚀 Core Features & Architecture

Collision is a collaboration workspace for music producers, engineers, and clients. It provides:
1. **Interactive Audio Player:** Waveform visualization powered by WaveSurfer.js with high-precision, low-latency looping (click & drag to select loop region).
2. **Project-Level Access Control:** Collaborators are invited to specific projects. Sidebar displays projects dynamically filtered by the active user's permissions.
3. **Advanced Lyrics Editor:** Line-by-line typing with automatic chronological sorting, keyboard-driven controls (Enter to split/add lines, Backspace to delete timestamps or merge lines), and automatic strikethrough edit history.
4. **Time-Linked Comments:** Collaborators can leave comments pinned to specific timestamps. Clicking a comment's timestamp instantly seeks the audio playhead to that position.
5. **Audio Idea Notes:** Attach local audio clips directly to comments. Doing so automatically saves the clip under the project's main sample directory and renders a mini audio player within the comment card.
6. **Multi-Tab Sync:** Uses the browser `BroadcastChannel` API to sync state in real-time across tabs/windows without a complex backend database.

---

## 🌐 How to Deploy Live for Free

Since Collision is a React + Vite frontend application, you can publish it to the web for free in under 5 minutes using modern hosting platforms. Here are the step-by-step instructions for the two most popular choices.

### Option A: Deploy with Vercel (Recommended)
Vercel is the creator of Next.js and has excellent support for Vite apps.

1. **Sign Up:** Create a free account on [Vercel](https://vercel.com/) (sign in with your GitHub, GitLab, or Bitbucket account).
2. **Connect Repository:** 
   - Push your project code to GitHub.
   - Click "Add New" -> "Project" in the Vercel Dashboard.
   - Select your code repository.
3. **Configure Settings:**
   - **Framework Preset:** Select **Vite** (Vercel usually autodetects this).
   - **Root Directory:** If deploying from a monorepo, set this to `packages/frontend`. Otherwise, leave as root.
   - **Build Command:** `npm run build` (or `tsc -b && vite build`)
   - **Output Directory:** `dist`
4. **Deploy:** Click **Deploy**. Vercel will build and launch your site, providing you with a free `https://your-app.vercel.app` URL.

### Option B: Deploy with Netlify
Netlify is another top-tier static hosting platform with an incredibly simple interface.

1. **Sign Up:** Create a free account on [Netlify](https://www.netlify.com/).
2. **Import Project:**
   - Click "Import from Git" and select your repository host.
   - Authorize Netlify to access your repository.
3. **Build & Deploy Settings:**
   - **Branch to Deploy:** `main` (or `master`)
   - **Base Directory:** `packages/frontend` (if inside a monorepo workspace)
   - **Build Command:** `npm run build`
   - **Publish Directory:** `packages/frontend/dist` (or just `dist` if Base Directory is set)
4. **Deploy:** Click **Deploy site**. Netlify will build it and give you a custom `https://site-name.netlify.app` domain.

---

## 🔒 Going Production-Ready (Next Steps)
To convert this MVP into a fully productionized web app:
1. **Database:** Migrate the client-side BroadcastChannel state to a real-time database (e.g. Google Cloud Firestore or Supabase) to sync across different devices/networks.
2. **Authentication:** Add user login using a service like Firebase Auth or Supabase Auth.
3. **Storage:** Use Cloud Storage (e.g. Firebase Storage or AWS S3) instead of local object URLs to host and share actual audio files.
