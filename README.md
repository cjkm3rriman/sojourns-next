# Sojourns

A concise overview of the project with links to deeper documentation and standard development commands.

## Quick Start

- npm install — Install Node dependencies (use `npm ci` once `package-lock.json` exists).
- npm run dev — Start Next.js dev server at http://localhost:3000.
- npm run build && npm start — Production build and run.
- npm run lint / npm run fmt — Lint and format code.
- make setup/run/test also work if you prefer Make.

## Getting Started

- Prereqs: Node >= 18.17 (see `.nvmrc`), npm or pnpm, and Git.
- Setup:
  - Copy envs: `cp .env.example .env.local` and fill Clerk keys.
  - Install deps: `make setup` (or `npm ci`).
- Develop: `make run` (or `npm run dev`) and visit http://localhost:3000.
- Test: `make test` (or `npm test`) for unit tests with coverage (Vitest).
- Lint/Format: `make lint` and `make fmt` (or `npm run lint` / `npm run fmt`).

## Auth (Clerk)

- Install deps: `npm install @clerk/nextjs`
- Env vars: copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- Sign-in/up routes: `/sign-in` and `/sign-up` are pre-wired.
- Protected route: `/dashboard` requires auth (via `middleware.ts`).
- Home page shows Sign In/Up buttons and a `UserButton` when signed in.

## Documentation

- Overview: docs/overview.md
- Architecture: docs/architecture/README.md
- Decisions (ADRs): docs/decisions/ADR-001-initial-stack.md
- Roadmap: docs/roadmap.md
- Glossary: docs/glossary.md
- Contributor Guide: AGENTS.md

## Repository Structure

- `app/`: Next.js App Router pages/components.
- `public/`: Static assets served at root.
- `src/`: Additional libraries/modules. Example: `src/lib/date.ts`.
- `tests/`: Unit/integration tests mirroring `src/`. Fixtures under `tests/fixtures`, sample data under `tests/data`.
- `scripts/`: Local/CI helper scripts.
- `docs/`: Overview, architecture, ADRs, roadmap, glossary.

## Contributing

Follow AGENTS.md for style, testing, and PR conventions. Propose architectural changes via ADRs under docs/decisions.

## Deployment

- Vercel (recommended): Import the GitHub repo in Vercel. Node 20 is pinned via `.nvmrc`. Environment variables go in Project Settings. Build command: `npm run build` (also set in `vercel.json`).
- Docker (alternative): Create an image and run in your platform of choice. Example Dockerfile can be added on request.

### One‑click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USER%2FYOUR_REPO)

Replace `YOUR_USER/YOUR_REPO` with your GitHub path.

## Status

- Vercel Project: https://vercel.com/callum-merrimans-projects/sojourns-next

- GitHub Deployments (Production):

  [![Vercel](https://img.shields.io/github/deployments/cjkm3rriman/sojourns-next/Production?label=vercel&logo=vercel)](https://vercel.com/callum-merrimans-projects/sojourns-next)
