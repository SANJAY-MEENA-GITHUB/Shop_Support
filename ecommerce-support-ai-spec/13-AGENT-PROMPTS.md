# 13 — Agent Prompts (copy-paste, run in order)

> Paste each prompt into your AI agent **with the spec files it references attached/open**. Do not merge phases. After each phase, run its verification command before continuing.

---

## Phase 0 — Scaffold

```
You are building an e-commerce support platform. Read 00-PROJECT-OVERVIEW.md, 02-ARCHITECTURE.md, 11-DEVOPS-DOCKER.md, and templates/ (docker-compose.yml, .env.example).

Create the monorepo scaffold exactly as in 02-ARCHITECTURE.md §3:
- backend/ (Node 20 + TS + Express + Prisma + Zod + Pino + Helmet) with package.json, tsconfig, Dockerfile, src/index.ts + app.ts (health route only), config/env.ts, lib/prisma.ts, lib/logger.ts, lib/errors.ts
- frontend/ (React 18 + Vite + TS + React Router + TanStack Query + Axios + Lucide) with package.json, tsconfig, vite.config.ts, Dockerfile, src/main.tsx + App.tsx (placeholder routes), styles/tokens.css from 12-DESIGN-SYSTEM.md
- docker-compose.yml (db + backend + frontend), .env.example, .gitignore, README.md (setup + run commands from 11-DEVOPS-DOCKER.md §4)

Verify: `docker compose up --build` starts all 3 services; GET /api/health returns 200.
```

## Phase 1 — Database + Auth

```
Read 03-DATABASE-SCHEMA.md and 04-API-SPECIFICATION.md §2, §8, §9.

Implement:
1. prisma/schema.prisma with all 8 models + enums exactly as specified (add Order.displayId String @unique).
2. prisma/seed.ts with the 4 users + 4 orders + tickets/escalation from §5 (hash passwords with bcrypt).
3. Auth: POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me + middleware/auth.ts (JWT verify + requireRole) + services/auth.service.ts.
4. Run migration + seed. Verify: register → login → /me works; wrong password → 401.

Rules: Zod validation on all inputs. Never return passwordHash. JWT 24h, secret from env.
```

## Phase 2 — Core APIs (orders, tickets, refunds, escalations)

```
Read 03-DATABASE-SCHEMA.md, 04-API-SPECIFICATION.md §3–§6, 06-BACKEND-SPEC.md, 08-BUSINESS-RULES.md.

Implement services + routes for orders, tickets (+ messages + notes), refunds, escalations, users (admin role change), audit logging.
RefundService is the sole authority: implement validateEligibility (R1–R8), idempotency via idempotencyKey unique constraint, ₹5,000 escalation, simulated payment execution (payment.simulated.ts, SIM- refs, no network).
Enforce ticket/refund state machines from 08-BUSINESS-RULES.md §4. Ownership scoping: customers see only own data (404 on cross-access).
Mount Swagger UI at /api/docs from templates/openapi/openapi.yaml.

Verify: curl the happy path (create ticket → message → refund ≤₹5,000 → PROCESSED) and the escalation path (₹8,500 → ESCALATED).
```

## Phase 3 — AI agent (Gemini + mock + RAG)

```
Read 07-AI-AGENT-SPEC.md and 08-BUSINESS-RULES.md §3.

Implement:
1. ai/policy.ts — keyword RAG over backend/policy/*.md (copy templates/policy/ into backend/policy/).
2. ai/tools.ts — the 4 tools with exact signatures; executors call backend services with server-injected userId.
3. ai/systemPrompt.ts — hardened prompt from §4 (verbatim structure).
4. ai/agent.ts — Gemini orchestration (max 3 tool rounds, persist messages, safe fallback + auto-escalate on error).
5. ai/mockAgent.ts — deterministic fallback when GEMINI_API_KEY is empty (must pass T3/T8).
6. POST /chat + GET /chat/history/:ticketId. Health reports aiMode.

Verify: mock-mode chat without order ID asks for ID and creates no refund; with ORD-1001 completes eligible refund.
```

## Phase 4 — Frontend

```
Read 05-FRONTEND-SPEC.md and 12-DESIGN-SYSTEM.md (Industrial tokens — follow exactly).

Build all pages/routes from 05 §1–§2 with TanStack Query + Axios (lib/api.ts with JWT interceptor), AuthContext + route guards, and reusable components (Layout, StatusBadge, EmptyState, LoadingState, ErrorState).
Every page must implement loading / empty / error / validation states (05 §5). Responsive per 05 §6. Lucide icons only. No dangerouslySetInnerHTML. No fabricated data — all numbers from API.

Verify: `npm run build` passes tsc; login → dashboard → ticket thread → staff queue all render with real API data.
```

## Phase 5 — Tests + polish

```
Read 10-TESTING-SPEC.md, 09-SECURITY-SPEC.md, 14-ACCEPTANCE-CHECKLIST.md.

Write backend tests covering T1–T10 exactly as specified (mock AI mode, test DB). Add frontend smoke tests. Run `npm test` until 100% pass. Run `npm audit` and fix highs.
Complete README.md (prereqs, setup, env, DB/migrations, seed, run, tests, architecture + ERD links, framework justification from 00 §2), architecture diagram (docs/architecture.mmd), ER diagram (docs/erd.mmd), and demo script (10 §5).

Verify: clean-checkout `docker compose up --build` + seed + `npm test` all pass. Walk 14-ACCEPTANCE-CHECKLIST.md line by line.
```

---

## Tips for the agent session

- Keep the spec folder open in the workspace so the agent can reference files by path.
- If the agent drifts (wrong stack, invented endpoints, rounded-corner UI), stop and re-paste the relevant spec section.
- Commit after each phase (`git commit`) so you can roll back a bad generation.
