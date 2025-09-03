# Sojourn

A concise overview of the project with links to deeper documentation and standard development commands.

## Quick Start
- npm install — Install Node dependencies (use `npm ci` once `package-lock.json` exists).
- npm run dev — Start Next.js dev server at http://localhost:3000.
- npm run build && npm start — Production build and run.
- npm run lint / npm run fmt — Lint and format code.
- make setup/run/test also work if you prefer Make.

## Documentation
- Overview: docs/overview.md
- Architecture: docs/architecture/README.md
- Decisions (ADRs): docs/decisions/ADR-001-initial-stack.md
- Roadmap: docs/roadmap.md
- Glossary: docs/glossary.md
- Contributor Guide: AGENTS.md

## Repository Structure
- app/ — Next.js App Router pages/components.
- public/ — Static assets served at root.
- src/ — Additional libraries/modules (optional).
- tests/ — Unit/integration tests (optional).
- scripts/ — Local/CI helper scripts.
- docs/ — Overview, architecture, ADRs, roadmap, glossary.
- public/ or assets/ — Static assets if applicable.

## Contributing
Follow AGENTS.md for style, testing, and PR conventions. Propose architectural changes via ADRs under docs/decisions.

## Deployment
- Vercel (recommended): Import the GitHub repo in Vercel, set Node 20, and connect. Environment variables go in Project Settings. Builds run `npm run build`; output is auto-detected.
- Docker (alternative): Create an image and run in your platform of choice. Example Dockerfile can be added on request.
