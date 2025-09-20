# Repository Guidelines

## Project Structure & Module Organization

- src/: Application code by domain (e.g., src/api, src/cli, src/lib).
- tests/: Mirrors src; fixtures in tests/fixtures; sample data in tests/data.
- scripts/: One-off utilities and CI helpers (bash, node, or python).
- docs/: Design notes, ADRs, and architecture diagrams.
- public/ or assets/: Static files served or bundled with releases.

## Build, Test, and Development Commands

This repository favors simple Makefile wrappers. Examples:

- make setup: Install dependencies for the active language(s).
- make run: Start the local app (server or CLI) with hot reload if available.
- make test: Run unit tests with coverage output.
- make lint and make fmt: Lint and auto-format the codebase.
- make build: Produce a release artifact (binary, package, or dist/).
  If not using Make, mirror these via npm scripts or task runners.

## Coding Style & Naming Conventions

- Formatting: Use Prettier for JS/TS and Black + Ruff for Python (if applicable). Commit only formatted code.
- Indentation: 2 spaces for web code; 4 spaces for Python.
- Naming: snake_case for Python modules; kebab-case for dirs; camelCase for functions/vars; PascalCase for classes/types.
- Structure: Keep files focused; prefer small, pure functions and cohesive modules.
- CSS Approach: **Prefer CSS classes over inline styles**. Use semantic class names that describe content/function (e.g., `flight-title`, `flight-departure`). Move all styling to CSS files for better maintainability, performance, and separation of concerns. Only use inline styles for dynamic properties that can't be predefined.

## Testing Guidelines

- Frameworks: pytest (Python) or Vitest/Jest (JS/TS).
- Layout: tests/ mirrors src/ (e.g., src/lib/date.ts -> tests/lib/date.test.ts).
- Naming: test\_<module>.py, <name>.test.ts, or <name>.spec.ts.
- Coverage: Aim for 80%+ overall and 90% on critical paths. Include edge cases and failure modes.

## Commit & Pull Request Guidelines

- Pre-commit: Always run `make ci` before committing and pushing to GitHub to ensure all checks pass.
- Commits: Conventional Commits (feat|fix|docs|refactor|test|build|ci|chore): concise, imperative subject; useful body.
- PRs: Small, focused changes. Include description, linked issues, screenshots (if UI), and test/validation steps.
- Checks: Lint, format, tests, and coverage must pass. Update docs for user-visible changes.

## Security & Configuration Tips

- Never commit secrets. Use .env with .env.example; example: cp .env.example .env.
- Pin dependencies and run security checks (e.g., make audit) when available.
- Review third-party licenses for compliance before introducing new deps.

## Database Migration Guidelines

### Current Setup

- Using Drizzle ORM with PostgreSQL (Neon)
- Schema defined in `lib/db/schema.ts`
- Migrations in `lib/db/migrations/`
- Config in `drizzle.config.ts`

### Development Workflow

**For Development (Recommended):**

```bash
# Make schema changes in lib/db/schema.ts
# Then apply directly to database:
npm run db:push
```

### Migration Conflict Resolution

**Root Causes:**

- Manual SQL migrations mixed with generated ones
- Database state doesn't match drizzle metadata
- Journal (`_journal.json`) out of sync with actual migrations

**Resolution Strategies:**

1. **Continue using `db:push`** (recommended for development)
   - Simple, immediate, no conflicts
   - Good for rapid iteration

2. **Reset migration state** (for production setup):

   ```bash
   # Backup data first
   rm -rf lib/db/migrations/00*
   rm -rf lib/db/migrations/meta/00*
   echo '{"version": "7", "dialect": "postgresql", "entries": []}' > lib/db/migrations/meta/_journal.json
   npm run db:generate -- --name="baseline"
   ```

3. **Never mix methods**: Don't use both `db:push` and migrations in same environment

### Available Commands

- `npm run db:generate` - Generate new migration
- `npm run db:migrate` - Apply pending migrations
- `npm run db:push` - Push schema changes directly (development)
- `npm run db:studio` - Open Drizzle Studio

## Coding Proficiency

- Computer Science degree, but rusty programmer who has been doing Product for the past 15 years. Low familiarity with react and next. Explaing what you are doing more than you would typically. Keep things simple unless complexity needed to achieve goals.
