# 05 — Frontend Specification (React + TypeScript)

## 1. Routes

| Route | Guard | Page |
|---|---|---|
| `/login`, `/register` | public (redirect if authed) | Auth forms |
| `/` | customer | Customer dashboard |
| `/orders`, `/orders/:id` | customer | Order list + detail |
| `/tickets/new` | customer | New ticket form |
| `/tickets`, `/tickets/:id` | customer | Ticket list + thread (chat + refund progress) |
| `/refunds`, `/refunds/:id` | customer | Refund list + detail |
| `/staff` | staff/admin | Staff dashboard (counts + queues) |
| `/staff/tickets`, `/staff/tickets/:id` | staff/admin | Triage list + detail (reply, notes, status) |
| `/staff/escalations`, `/staff/escalations/:id` | staff/admin | Escalation queue + decision |
| `/staff/refunds` | staff/admin | Refund review queue |
| `/staff/orders` | staff/admin | All orders (read-only context) |

Guards: `AuthContext` holds `{ user, token }` (token in `localStorage` under `support_token` — acceptable for local evaluation; note the trade-off in README). Unauthenticated → `/login`. Wrong role → redirect to own home.

## 2. Pages (what each must show)

- **Login/Register:** email + password (+ name on register). Inline validation errors, server error banner, loading spinner on submit, "Sign in" / "Create account" standard copy. Link between them.
- **Customer Dashboard:** recent orders (5), open tickets (5), active refunds with status. Each row links to detail. Empty states when none.
- **Order Detail:** status, delivery date, items table, total, "Create ticket" + "Request refund" actions (refund opens modal with amount/reason; generates `idempotencyKey` via `crypto.randomUUID()`).
- **New Ticket:** category select, subject, description, optional order select (own orders). Submit → redirect to ticket thread.
- **Ticket Detail (customer):** message thread (bubbles by sender type, timestamps), AI chat input at bottom (posts to `/chat`), refund progress card (status timeline: Requested → Under review → Approved/Rejected → Processed), order context card if linked.
- **Staff Dashboard:** counts (open, escalated, pending refunds, pending escalations) from API — never hardcoded. Quick links to queues.
- **Staff Ticket Detail:** thread + order context + refund/escalation cards + reply box + internal note box + status/priority/assignee controls.
- **Escalation Detail:** summary, priority, linked ticket/refund, decision buttons (Approve / Reject / Request info) + note field.

## 3. Components (reusable)

`Layout` (header with user name + role + Sign out; nav switches by role), `StatusBadge` (maps status → signal color + label), `PriorityBadge`, `EmptyState` (icon + message + optional action), `LoadingState` (spinner + "Loading…"), `ErrorState` (message + Retry button), `Pagination`, `Modal` (refund request), `ChatThread`, `RefundTimeline`.

## 4. Data layer

- `lib/api.ts`: axios instance, baseURL from `VITE_API_URL` (default `http://localhost:4000/api`), request interceptor adds JWT, response interceptor on 401 clears token + redirects to `/login`.
- TanStack Query for all server state (`useQuery`/`useMutation`). Query keys: `['orders']`, `['tickets', filters]`, `['ticket', id]`, `['refunds']`, etc. Invalidate on mutations.
- `lib/types.ts`: TypeScript interfaces mirroring `04-API-SPECIFICATION.md` responses. No `any` in components (lint-enforced).

## 5. UI states (every data page)

| State | Treatment |
|---|---|
| Loading | `LoadingState` skeleton/spinner; disable submit buttons |
| Empty | `EmptyState` with specific copy ("No open tickets", "No refunds yet") + CTA |
| Error | `ErrorState` with server message + Retry (refetch) |
| Validation | Inline field errors under inputs; submit disabled until valid |
| Success | Toast or inline confirmation + redirect/invalidate |

## 6. Responsive

- Mobile (≤ 768px): single column, nav collapses to top bar + horizontal scroll tabs, tables become stacked rows (CSS, no JS breakpoint hacks).
- Desktop: two-column detail layouts (thread + context sidebar ≥ 1024px).
- Touch targets ≥ 40px. No horizontal scroll at 360px.

## 7. Accessibility

- Semantic landmarks (`header`, `main`, `nav`), labels on all inputs, focus-visible outlines, color + text on status badges (never color alone), `aria-live="polite"` on chat thread for new messages.
