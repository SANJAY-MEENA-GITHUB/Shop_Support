# 09 — Security Specification

## 1. Authentication & authorization

- Passwords: `bcryptjs`, cost 12. Never store/log plain passwords. Login compares with `bcrypt.compare`.
- JWT: HS256, secret from `JWT_SECRET` (≥32 chars, fail startup if shorter), `expiresIn: '24h'`, payload `{ sub: userId, role }`. Verify on every protected route. No tokens in URLs.
- RBAC enforced **server-side on every route**: customer scope = `WHERE customerId = req.user.id`; staff scope = all. Frontend hiding is UX only.
- Cross-customer access returns **404** (not 403) to avoid confirming existence.

## 2. Input validation & injection

- All bodies/queries/params validated with Zod (strict on auth, strip-unknown elsewhere). Reject oversized payloads (`express.json` 100kb limit).
- SQL injection: Prisma parameterized queries only. **No `$queryRaw` with string interpolation** (lint rule + code review check).
- XSS: React auto-escapes; forbid `dangerouslySetInnerHTML` for user content (ESLint `react/no-danger`). Chat content rendered as text.
- Prompt injection: see `07-AI-AGENT-SPEC.md` §4. Additionally, backend re-validates every tool call (ownership, window, amount, threshold) — LLM output is untrusted input.

## 3. Secrets & config

- `.env` (gitignored) holds real values; `.env.example` holds placeholders only. Never commit `.env`, keys, or DB credentials.
- `docker-compose.yml` reads secrets from env vars, never hardcodes. `.dockerignore` excludes `.env`, `node_modules`, `*.log`.
- Gemini key sent only from backend to Google API over HTTPS. Never exposed to frontend (`VITE_` prefix forbidden for secrets).

## 4. Refund execution separation

- LLM → `process_refund` tool → `RefundService` (validation) → `SimulatedPaymentService` (execution). The LLM can *request*; only the service can *execute*. No code path lets LLM text set `PROCESSED` directly.
- Simulated payment makes **no network calls** to real rails. Payment refs prefixed `SIM-`.

## 5. Logging & privacy

- Structured JSON logs (pino). Redact: `password`, `token`, `authorization`, `passwordHash`, `GEMINI_API_KEY`.
- Log user IDs and entity IDs, not full message bodies or emails (emails only in auth events, masked as `a***@domain` if needed).

## 6. OWASP checklist (agent must verify)

- [ ] Broken access control: every route checks ownership/role (tests in `10-TESTING-SPEC.md`).
- [ ] Cryptographic failures: bcrypt + JWT secret length + HTTPS in prod notes.
- [ ] Injection: Zod + Prisma only; no raw SQL concat.
- [ ] Insecure design: refund state machine + idempotency + threshold enforced server-side.
- [ ] Security misconfig: helmet headers, CORS allowlist (single frontend origin), rate limits.
- [ ] Vulnerable components: `npm audit` clean (or documented exceptions) before submission.
- [ ] Logging failures: audit events for all refund/escalation decisions.

## 7. Threats explicitly tested

Cross-customer ticket/order access, unauthenticated API access, prompt injection bypass, duplicate refund replay, amount tampering (frontend sends ₹1, backend checks against order total), role escalation (customer calling staff routes).
