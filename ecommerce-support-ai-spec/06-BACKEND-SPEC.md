# 06 — Backend Specification (Node.js + Express + TypeScript)

## 1. Bootstrap (`src/index.ts`, `src/app.ts`)

- `app.ts` builds the Express app: `helmet()`, `cors({ origin: FRONTEND_URL })`, `express.json({ limit: '100kb' })`, `pino-http` request logging (no bodies), rate limiters, routers under `/api`, Swagger UI at `/api/docs`, 404 handler, central error handler.
- `index.ts` validates env, connects Prisma, runs `migrate deploy` check, listens on `PORT` (default 4000). Graceful shutdown on SIGTERM.

## 2. Config (`src/config/env.ts`)

Parse with Zod on startup; fail fast with clear message if missing:
`DATABASE_URL`, `JWT_SECRET` (≥32 chars), `PORT`, `FRONTEND_URL`, `GEMINI_API_KEY` (optional → mock mode), `GEMINI_MODEL` (default `gemini-2.0-flash`), `NODE_ENV`.

## 3. Middleware

| Middleware | Behavior |
|---|---|
| `auth` | Extract Bearer JWT → `verify` → `req.user = { id, role }`. Missing/invalid → 401. |
| `requireRole('SUPPORT','ADMIN')` | After auth; wrong role → 403. |
| `validate(schema)` | Zod parse body/query/params; failure → 400 envelope with field details. |
| `errorHandler` | Catches `ApiError` → envelope; unknown → 500 generic + log with request id. |
| Rate limit | Global 300/15min/IP; auth 100/15min; chat 30/min/user. |

## 4. Services (business logic lives here, never in routes)

- **`auth.service.ts`** — register (hash, unique check), login (compare, sign JWT 24h), `me`.
- **`order.service.ts`** — list/get with ownership scoping; eligibility helper delegates to refund service.
- **`ticket.service.ts`** — create (validate order ownership), list (filters/search), thread, status transitions (allowed map below), notes.
- **`refund.service.ts`** — **sole authority** for eligibility + execution (see `08-BUSINESS-RULES.md`). Methods: `validateEligibility(order, amount)`, `requestRefund(...)` (idempotent), `reviewRefund(...)`, `executeRefund(...)` (calls simulated payment).
- **`escalation.service.ts`** — create, decide (cascades to ticket + refund in a transaction).
- **`audit.service.ts`** — `log(userId, action, entity, entityId, details?)` — fire-and-forget, never throws into request path.
- **`payment.simulated.ts`** — `execute(amount, idempotencyKey)` → `{ success: true, paymentRef: 'SIM-<uuid>' }`. Deterministic failure hook: amount ending in `.99` with reason containing `FAIL` → `{ success: false }` (for testing the FAILED path). No network calls.

**Ticket status transitions (enforced):**
`OPEN → IN_PROGRESS → RESOLVED → CLOSED`, `OPEN/IN_PROGRESS → ESCALATED → IN_PROGRESS/RESOLVED`. `RESOLVED → CLOSED` only. Invalid → 422.

## 5. Routes

Thin handlers: validate → call service → shape response. No business logic, no Prisma calls in routes. Each route file exports a Router mounted in `app.ts`.

## 6. Logging (`src/lib/logger.ts`)

Pino JSON to stdout. Fields: `level, time, msg, requestId, userId, route, statusCode, durationMs`. Never log: passwords, tokens, `Authorization` header, full message bodies (log lengths only).

## 7. Errors (`src/lib/errors.ts`)

```ts
class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) {} }
```
Helpers: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `businessRule`. Prisma `P2002` (unique) → 409; `P2025` (not found) → 404.

## 8. Prisma client (`src/lib/prisma.ts`)

Singleton to avoid connection exhaustion in dev. `log: ['warn','error']` in dev, `['error']` in prod.

## 9. Swagger

`swagger-ui-express` + `swagger-jsdoc` (or serve `templates/openapi/openapi.yaml` directly). Mount at `/api/docs`. Keep the YAML in sync with `04-API-SPECIFICATION.md` — the YAML is the contract.
