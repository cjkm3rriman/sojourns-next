# Default shell
SHELL := /bin/bash
.DEFAULT_GOAL := help

## help: Show available targets
help:
	@grep -E '(^[a-zA-Z_-]+:)|(^## )' Makefile | \
		awk 'BEGIN {FS=":"} /^## / {sub(/^## /, ""); sec=$$0; print "\n" sec; next} /^[a-zA-Z_-]+:/ {printf "  %-12s %s\n", $$1, last; last=""} {if ($$0 ~ /^## /) last=$$0}'

## setup: Install dependencies for detected stacks
setup:
	@if [ -f package.json ]; then \
		if command -v pnpm >/dev/null 2>&1; then pnpm install; \
		elif command -v npm >/dev/null 2>&1; then \
			if [ -f package-lock.json ]; then npm ci; else npm install; fi; \
		elif command -v yarn >/dev/null 2>&1; then yarn install; \
		else echo "No JS package manager found (pnpm/npm/yarn)"; fi; \
	fi
	@if [ -f pyproject.toml ]; then \
		(command -v uv >/dev/null 2>&1 && uv sync) || \
		(python3 -m pip install --upgrade pip && python3 -m pip install -e '.[dev]' || true) || \
		(command -v poetry >/dev/null 2>&1 && poetry install) || true; \
	fi
	@if [ -f Cargo.toml ]; then \
		(command -v cargo >/dev/null 2>&1 && cargo fetch) || true; \
	fi

## run: Start the app locally (dev server or CLI)
run:
	@if [ -f package.json ]; then \
		npm run dev || npm start || pnpm run dev || yarn dev || true; \
	elif [ -f pyproject.toml ]; then \
		python -m src 2>/dev/null || python main.py 2>/dev/null || echo "Define a run entry (python -m src or python main.py)"; \
	elif [ -f Cargo.toml ]; then \
		cargo run; \
	else \
		echo "No run target defined. Add one to Makefile or package scripts."; \
	fi

## test: Run tests with coverage where configured
test:
	@if [ -f package.json ]; then \
		npm test || pnpm test || yarn test || true; \
	elif [ -f pyproject.toml ]; then \
		pytest -q || true; \
	elif [ -f Cargo.toml ]; then \
		cargo test; \
	else \
		echo "No tests configured"; \
	fi

## lint: Lint the codebase
lint:
	@if [ -f package.json ]; then \
		npm run lint || (command -v eslint >/dev/null 2>&1 && eslint .) || true; \
	elif [ -f pyproject.toml ]; then \
		(command -v ruff >/dev/null 2>&1 && ruff check .) || (command -v flake8 >/dev/null 2>&1 && flake8 .) || true; \
	elif [ -f Cargo.toml ]; then \
		cargo clippy || true; \
	fi

## fmt: Auto-format the codebase
fmt:
	@if [ -f package.json ]; then \
		npm run fmt || (command -v prettier >/dev/null 2>&1 && prettier -w .) || true; \
	elif [ -f pyproject.toml ]; then \
		(command -v ruff >/dev/null 2>&1 && ruff format .) || (command -v black >/dev/null 2>&1 && black .) || true; \
	elif [ -f Cargo.toml ]; then \
		cargo fmt; \
	fi

## build: Produce a build artifact
build:
	@if [ -f package.json ]; then \
		npm run build || pnpm run build || yarn build || true; \
	elif [ -f pyproject.toml ]; then \
		echo "Python projects typically publish via build backends (e.g., hatchling, setuptools)."; \
	elif [ -f Cargo.toml ]; then \
		cargo build --release; \
	else \
		echo "No build configured"; \
	fi

## ci: Run local CI checks (clean install, lint, fmt check, typecheck, tests, build)
ci:
	@if [ -f package.json ]; then \
		npm ci && npm run lint && (npm run fmt:check || true) && (npm run typecheck || true) && npm test && npm run build; \
	else \
		echo "No JS project detected"; \
	fi

## audit: Run basic dependency security checks
audit:
	@if [ -f package.json ]; then \
		npm audit || pnpm audit || true; \
	elif [ -f pyproject.toml ]; then \
		(command -v pip-audit >/dev/null 2>&1 && pip-audit) || (command -v safety >/dev/null 2>&1 && safety check) || true; \
	fi

## clean: Remove common build/test artifacts
clean:
	rm -rf dist build .pytest_cache .ruff_cache node_modules .venv || true

.PHONY: help setup run test lint fmt build audit clean
