# Slack Clone

A real-time team messaging app built with Next.js and Convex — workspaces, channels, DMs, threads, huddles, and an AI assistant baked into the chat itself.

## Features

### Messaging
- **Workspaces** with admin/member roles, an invite link, and a regenerable join code
- **Channels** (create, rename, delete) and **direct messages** between any two members
- **Threaded replies** on any message, with a dedicated "My Threads" view across the workspace
- **Rich text composer** (Quill) with bold/italic/lists and `@mention` autocomplete for members and the AI bot
- **Emoji reactions**, message editing and deletion
- **Image and voice message** attachments (recorded in-browser, uploaded to Convex file storage)
- **Drafts** — an unsent composer body is saved per channel/DM per member and picked back up later, with a "Drafts" view listing every one you have open
- **Activity feed** — mentions, thread replies, and reactions to your messages, with an unread badge and mark-all-read
- **Presence** — a lightweight heartbeat tracks each member's last-seen time

### Huddles
- Start a live audio/video **huddle** in any channel or DM, powered by LiveKit; join/leave updates the active participant list in real time for everyone in that channel/DM

### AI
- **@ai mentions** — mention the bot in a channel, thread, or DM and it replies in-line (Gemini), reading recent context and able to `@mention` real members back
- **Conversation summarization** — condense a channel, DM, or thread's recent messages into a bullet-point digest on demand, without posting it to the conversation
- **Team Pulse** — lightweight sentiment/burnout signal derived from message tone and late-night activity, with a personal view for every member and an admin-only team view (risk scores, trend chart, AI-generated wellness insight)

### Platform
- **Authentication** via Convex Auth: email/password, GitHub, and Google
- **Load testing harness** (`loadtest/`) that drives real virtual users against the Convex backend to measure latency and throughput per function

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Convex](https://convex.dev/) for the database, server functions, realtime sync, file storage, and auth
- [Convex Auth](https://labs.convex.dev/auth) (Password, GitHub, Google providers)
- [LiveKit](https://livekit.io/) for huddle audio/video
- [Google Gemini](https://ai.google.dev/) for the AI bot, summarization, and wellness insights
- Tailwind CSS + Radix UI + shadcn-style components, Quill editor, Jotai, nuqs

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Convex (creates/links a dev deployment and generates `.env.local`):
   ```bash
   npx convex dev
   ```
3. In a second terminal, start the Next.js dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

### Environment variables

`npx convex dev` writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` for you. The rest are set on the **Convex deployment** (dashboard → Settings → Environment Variables, or `npx convex env set NAME value`), not in `.env.local`:

| Variable | Used for |
|---|---|
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub sign-in |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google sign-in |
| `GEMINI_API_KEY` | `@ai` replies, summarization, wellness insights |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | Huddle token minting |

Features degrade gracefully without the optional keys (e.g. no GitHub button without GitHub creds), except the AI and huddle features, which need their respective keys to work at all.

## Scripts

```bash
npm run dev        # Next.js dev server
npm run build       # production build
npm run start       # run the production build
npm run lint         # eslint
npm run loadtest    # drive virtual users against the Convex backend — see loadtest/README.md
```

## Project structure

- `src/app/` — routes (auth, workspace shell, channel, DM, threads, activity, drafts, pulse)
- `src/features/` — feature-sliced client code (api hooks, components, stores) per domain: workspaces, channels, conversations, messages, threads, reactions, activity, drafts, calls, wellness, members, upload, auth
- `convex/` — backend: schema and all queries/mutations/actions, one file per domain (`messages.ts`, `calls.ts`, `ai.ts`, `wellness.ts`, `activity.ts`, `drafts.ts`, `livekit.ts`, `auth.ts`, ...)
- `loadtest/` — standalone load-testing harness against the Convex backend

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Convex documentation](https://docs.convex.dev/)
- [Convex Auth documentation](https://labs.convex.dev/auth)
- [LiveKit documentation](https://docs.livekit.io/)
