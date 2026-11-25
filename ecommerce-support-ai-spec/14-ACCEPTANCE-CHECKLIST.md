# 14 — Acceptance Checklist (map to assignment rubric)

Check each box only when you can demonstrate it (test output, screenshot, or live URL). All must pass before submission.

## A. Frontend (Assignment §3A)
- [ ] Responsive React + TypeScript app (desktop + mobile, no horizontal scroll at 360px).
- [ ] Register / login / logout screens work; unauthenticated users redirected to login.
- [ ] Customer dashboard shows recent orders, open tickets, ticket/refund statuses (from API).
- [ ] Ticket creation form: category, subject, description, optional order selection.
- [ ] Chat interface: customer messages, agent responses, timestamps, status indicators.
- [ ] Order details + refund progress in clear customer-friendly views.
- [ ] Staff dashboard: ticket list, search/filter, priority, status, detail views.
- [ ] Escalation review view: approve / reject / request-info for authorized staff.
- [ ] Loading, empty, validation, and error states on every data page.

## B. Backend & API (Assignment §3B)
- [ ] REST APIs for auth, users, orders, tickets, messages, refunds, escalations.
- [ ] Request validation + consistent error envelope + correct HTTP codes (see `04` §9).
- [ ] Role-based authorization server-side; customers access only own records.
- [ ] Business rules in backend services (no frontend-only security/eligibility).
- [ ] OpenAPI/Swagger at `/api/docs` matching implemented routes.

## C. Database (Assignment §3C)
- [ ] PostgreSQL schema with Users, Orders, Tickets, Messages, Refunds, Escalations/Notes (+ AuditLog).
- [ ] Migrations committed; FK constraints + sensible indexes.
- [ ] Seed data (4 users, 4 orders, tickets) — app runs without real commerce platform.

## D. AI agent (Assignment §3D)
- [ ] Agent retrieves policy (RAG), queries orders, validates rules, takes allowed action or escalates (4 tools).
- [ ] Multi-turn context; asks for missing order ID before order-specific actions.
- [ ] Pre-refund verification: ownership, delivery date, window, amount, refund status.
- [ ] Refunds > ₹5,000 escalated, never auto-approved.
- [ ] Prompt-injection resistant; mocked/simulated payment only (no real rails).
- [ ] Chat + ticket status persisted; customer can return to conversation.

## E. Business rules (Assignment §4)
- [ ] Missing order ID → asks, no premature tool calls.
- [ ] Eligible refund → verified, exactly one refund record.
- [ ] Expired window → not processed, policy explained, interaction recorded.
- [ ] Invalid/inaccessible order → safe error, no data leak.
- [ ] Duplicate/retry → idempotency prevents duplicate transactions.
- [ ] Tool/DB failure → graceful error, no false success.

## F. Security (Assignment §5)
- [ ] Passwords bcrypt-hashed; authenticated APIs protected; authorization on every sensitive resource.
- [ ] No secrets committed; `.env.example` with placeholders only.
- [ ] Input validated/sanitized; no SQL injection; no unsafe rendering of user content.
- [ ] Refund execution separated from LLM decisions; backend is final authority.
- [ ] Audit events for refunds/approvals/rejections/escalations; structured logs without secrets.

## G. Testing (Assignment §6)
- [ ] `npm test` passes: auth/access, ticket+conversation, missing-ID, eligible, expired, >₹5,000, duplicate, injection, failure scenarios (T1–T10).
- [ ] Test run instructions in README.

## H. Submission (Assignment §7)
- [ ] GitHub repo (preferred) or ZIP with source code.
- [ ] README.md: prereqs, setup, env vars, DB setup/migrations, seed, run commands.
- [ ] Architecture diagram (frontend/backend/DB/AI/tools/human-review).
- [ ] DB schema / ER diagram.
- [ ] API docs or exported collection (OpenAPI YAML + Swagger UI).
- [ ] Automated tests + run instructions.
- [ ] Demo video (5–10 min) or live walkthrough script (see `10` §5).
- [ ] `.env.example` included; no real credentials anywhere.

## I. Design (SKILL.md)
- [ ] Industrial anchor held: mono type, black surface, 1px borders, signal green, no radius/shadow/serif.
- [ ] Ticket Ledger differentiator visible; content discipline (no fabrication/filler/themed copy).
