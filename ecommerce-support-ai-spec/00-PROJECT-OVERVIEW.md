# 00 — Project Overview

## 1. What we are building

A full-stack **e-commerce customer support platform** where:

- **Customers** register/sign in, view their orders, raise support tickets, chat with an **AI support agent** (Google Gemini), request refunds, and track ticket/refund status.
- **Support staff / Admins** sign in to an internal dashboard, review and filter tickets, inspect order + conversation context, handle escalations, approve/reject refund requests, add internal notes, and update ticket status.

The system demonstrates practical engineering across UI, backend APIs, persistent storage, authentication, AI-assisted workflows, testing, and local deployment.

## 2. Why this stack (deviation from assignment default)

The assignment recommends Python + FastAPI but explicitly allows *"an equivalent documented backend framework if APIs are documented."* We choose **Node.js + TypeScript + Express + Prisma** because:

1. Single language (TypeScript) across frontend and backend — shared types, one mental model for the AI agent and reviewer.
2. Gemini's official JS SDK (`@google/genai`) is first-class; tool-calling examples are abundant.
3. Prisma gives typed migrations + seed in one tool, satisfying the DB requirement with less boilerplate than raw SQL.
4. Docker Compose runs identically on Windows/macOS/Linux for evaluation.

**Trade-off acknowledged:** FastAPI's auto-generated OpenAPI is lost. We compensate with `templates/openapi/openapi.yaml` + Swagger UI mounted at `/api/docs` (see `04-API-SPECIFICATION.md` §9).

## 3. Locked technology

| Layer | Choice | Version / package |
|---|---|---|
| Frontend | React + TypeScript + Vite | React 18, Vite 5, TS 5 |
| Routing | React Router | `react-router-dom` v6 |
| Server state | TanStack Query | `@tanstack/react-query` v5 |
| HTTP | Axios (interceptor for JWT) | `axios` v1 |
| Icons | Lucide | `lucide-react` (real icon set only) |
| Backend | Node.js + Express + TypeScript | Node 20 LTS, Express 4 |
| ORM / migrations | Prisma | `prisma` v5, `@prisma/client` |
| DB | PostgreSQL | 16 (Docker) |
| Auth | JWT (access token) + bcryptjs | `jsonwebtoken`, `bcryptjs` |
| Validation | Zod (shared schemas) | `zod` v3 |
| AI | Google Gemini API | `@google/genai`, model `gemini-2.0-flash` |
| Logs | Pino (structured JSON) | `pino`, `pino-http` |
| Security | Helmet, CORS, rate-limit | `helmet`, `cors`, `express-rate-limit` |
| Tests | Vitest + Supertest + Testing Library | `vitest`, `supertest`, `@testing-library/react` |
| Deployment | Docker + Compose | 3 services: `frontend`, `backend`, `db` |

No other frameworks. No Next.js. No Python. No vector DB (keyword RAG is intentional — see `07-AI-AGENT-SPEC.md`).

## 4. Scope

**In scope:** auth (register/login/logout), customer dashboard, orders, tickets + messages, AI chat with tools, refunds + simulated execution, escalations, internal notes, staff dashboard, audit log, seed data, Docker local run, automated tests, OpenAPI docs, README + diagrams.

**Out of scope:** real payment gateway, email/SMS, file attachments, push notifications, multi-language UI, mobile native apps, cloud deployment (optional), vector embeddings.

## 5. Roles

| Role | Value in DB | Can do |
|---|---|---|
| Customer | `CUSTOMER` | Own orders/tickets/refunds only; chat; request refund |
| Support agent | `SUPPORT` | All tickets/orders/refunds; reply; notes; approve/reject ≤ policy; decide escalations |
| Admin | `ADMIN` | Everything support can + manage users/roles (minimal: list users, change role) |

## 6. Success definition

A reviewer can, from a clean checkout: `docker compose up --build`, seed, log in as seeded customer and staff, complete the 8 test scenarios in `10-TESTING-SPEC.md`, and see all tests pass. See `14-ACCEPTANCE-CHECKLIST.md`.
