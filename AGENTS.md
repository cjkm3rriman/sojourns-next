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

## Testing Guidelines
- Frameworks: pytest (Python) or Vitest/Jest (JS/TS).
- Layout: tests/ mirrors src/ (e.g., src/lib/date.ts -> tests/lib/date.test.ts).
- Naming: test_<module>.py, <name>.test.ts, or <name>.spec.ts.
- Coverage: Aim for 80%+ overall and 90% on critical paths. Include edge cases and failure modes.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (feat|fix|docs|refactor|test|build|ci|chore): concise, imperative subject; useful body.
- PRs: Small, focused changes. Include description, linked issues, screenshots (if UI), and test/validation steps.
- Checks: Lint, format, tests, and coverage must pass. Update docs for user-visible changes.

## Security & Configuration Tips
- Never commit secrets. Use .env with .env.example; example: cp .env.example .env.
- Pin dependencies and run security checks (e.g., make audit) when available.
- Review third-party licenses for compliance before introducing new deps.

## Coding Proficiency 
- Computer Science degree, but rusty programmer who has been doing Product for the past 15 years. Low familiarity with react and next
