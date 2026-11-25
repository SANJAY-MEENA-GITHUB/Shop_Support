# E-Commerce Support Platform — AI Agent Spec Bundle

> **Purpose:** This folder is a complete, build-ready specification for an AI coding agent (Cursor, Claude Code, Copilot, Windsurf, etc.) to generate the full application without guessing.
>
> **Stack (locked):** Frontend — React 18 + TypeScript + Vite · Backend — Node.js 20 + TypeScript + Express + Prisma · DB — PostgreSQL 16 · AI — Google Gemini API (tool-calling) + local keyword RAG over policy docs · Deployment — Docker + Docker Compose

## How to use this bundle

1. Unzip this folder into your project root (or keep it as `spec/` next to the generated code).
2. Open `13-AGENT-PROMPTS.md` and run the prompts **in order** (Phase 0 → Phase 5). Each prompt is self-contained — paste it into your AI agent along with the referenced spec files.
3. The agent must read the spec files named in each prompt before writing code. Do not skip phases.
4. After generation, verify against `14-ACCEPTANCE-CHECKLIST.md` and run the test suite in `10-TESTING-SPEC.md`.

## File map

| File | What it locks |
|---|---|
| `00-PROJECT-OVERVIEW.md` | One-page product definition, scope, out-of-scope, stack justification |
| `01-REQUIREMENTS.md` | Functional + non-functional requirements, user journeys, acceptance criteria |
| `02-ARCHITECTURE.md` | System diagram, folder structure, request flows, tech decisions |
| `03-DATABASE-SCHEMA.md` | ERD, full DDL, indexes, seed data spec |
| `04-API-SPECIFICATION.md` | Every REST endpoint: method, auth, validation, request/response, errors |
| `05-FRONTEND-SPEC.md` | Every page, component, route, state, and UI state (loading/empty/error) |
| `06-BACKEND-SPEC.md` | Node.js structure, services, middleware, auth, logging, error handling |
| `07-AI-AGENT-SPEC.md` | Gemini agent: tools, system prompt, RAG, guardrails, mock mode |
| `08-BUSINESS-RULES.md` | Refund eligibility, ₹5,000 threshold, idempotency, escalation matrix |
| `09-SECURITY-SPEC.md` | Auth, RBAC, injection, secrets, audit, OWASP checklist |
| `10-TESTING-SPEC.md` | Test plan + the 8 mandatory scenarios with exact assertions |
| `11-DEVOPS-DOCKER.md` | Dockerfiles, compose, env vars, local runbook |
| `12-DESIGN-SYSTEM.md` | Industrial design anchor: tokens, type, components, content discipline |
| `13-AGENT-PROMPTS.md` | Copy-paste generation prompts, phase by phase |
| `14-ACCEPTANCE-CHECKLIST.md` | Final pass/fail checklist mapped to the assignment rubric |
| `templates/` | Ready-to-copy starting files (env, compose, policy, seed, OpenAPI) |
| `docs/` | Mermaid diagrams (architecture + ERD) |

## Non-negotiable rules for the agent

- **Backend is the final authority** for eligibility, authorization, and refund execution. Never trust frontend checks.
- **No real payments.** Refunds go through a simulated payment service only.
- **No secrets in git.** Only `.env.example` with placeholders is committed.
- **No fabricated UI data.** Every number/label on screen must come from the API or be clearly authored sample content.
- **Follow `12-DESIGN-SYSTEM.md` tokens exactly.** One anchor (Industrial), no hybrid drift.

## Quick start (after generation)

```bash
cp .env.example .env        # fill GEMINI_API_KEY + JWT_SECRET
docker compose up --build   # postgres + backend + frontend
# seed: docker compose exec backend npx prisma db seed
# tests: docker compose exec backend npm test
```

See `11-DEVOPS-DOCKER.md` for the full runbook.
