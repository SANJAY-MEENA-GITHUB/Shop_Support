# 04 — API Specification (REST)

Base URL: `http://localhost:4000/api` · Auth: `Authorization: Bearer <JWT>` on all except `/auth/register`, `/auth/login`, `/health`, `/docs`.

## 1. Conventions

- Content-Type `application/json`. All money as numbers (₹, 2dp). All timestamps ISO 8601 UTC.
- Pagination: `?page=1&limit=20` (max 100). Response: `{ data: [...], page, limit, total }`.
- Sorting: `?sort=newest|oldest|priority` where applicable.
- IDs are UUIDs in API; display codes like `ORD-1001` are stored in `Order.displayId` (add `displayId String @unique` to Order — seed sets it; new orders get `ORD-<seq>`).

## 2. Auth

| Method & path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | public | `{ name, email, password }` | 201 `{ user, token }` | 400 validation, 409 email exists |
| `POST /auth/login` | public | `{ email, password }` | 200 `{ user, token }` | 401 invalid credentials |
| `POST /auth/logout` | user | — | 200 `{ message }` | 401 |
| `GET /auth/me` | user | — | 200 `{ user }` | 401 |

`user` = `{ id, name, email, role, createdAt }` (never `passwordHash`).

## 3. Orders

| Method & path | Auth | Notes |
|---|---|---|
| `GET /orders` | user | Customer: own only. Staff: all + `?status=&customerSearch=&page=&limit=` |
| `GET /orders/:id` | user | Ownership enforced (customer → 404 if not theirs) |
| `GET /orders/:id/eligibility` | user | Returns `{ eligible, reasons[], returnWindowDays, daysSinceDelivery, refundableAmount }` — computed by `RefundService`, reused by AI tool |

## 4. Tickets

| Method & path | Auth | Body / notes |
|---|---|---|
| `POST /tickets` | customer | `{ category, subject, description, orderId? }` → 201 ticket |
| `GET /tickets` | user | Customer: own. Staff: all + `?search=&status=&priority=&category=&assigneeId=&sort=` |
| `GET /tickets/:id` | user | Includes `messages[]`, `order` (if linked), `refunds[]`, `escalations[]` |
| `PATCH /tickets/:id/status` | staff | `{ status, priority?, assigneeId? }` |
| `POST /tickets/:id/messages` | user | `{ content }` — customer own ticket only; staff any. Blocked if RESOLVED/CLOSED for customer |
| `GET /tickets/:id/messages` | user | Paginated thread, oldest first |
| `POST /tickets/:id/notes` | staff | `{ content }` internal note (never returned to customer) |
| `GET /tickets/:id/notes` | staff | List internal notes |
| `POST /tickets/:id/escalate` | user/staff | `{ summary, priority }` — customer may request; staff may escalate directly |

## 5. Refunds

| Method & path | Auth | Body / notes |
|---|---|---|
| `POST /refunds` | customer | `{ orderId, amount, reason, idempotencyKey, ticketId? }` → eligibility enforced server-side |
| `GET /refunds` | user | Customer: own (via order). Staff: all + `?status=&orderSearch=` |
| `GET /refunds/:id` | user | Ownership enforced |
| `PATCH /refunds/:id/review` | staff | `{ decision: APPROVED\|REJECTED\|NEEDS_INFO, note? }` — APPROVED triggers simulated execution |

## 6. Escalations

| Method & path | Auth | Notes |
|---|---|---|
| `GET /escalations` | staff | Queue: `?decision=&priority=&page=` |
| `GET /escalations/:id` | staff | Detail + linked ticket/refund context |
| `PATCH /escalations/:id/decision` | staff | `{ decision, internalNote?, assignedToId? }` — cascades to ticket + refund |

## 7. AI chat

| Method & path | Auth | Body | Response |
|---|---|---|---|
| `POST /chat` | customer | `{ ticketId?, message }` | 200 `{ reply, ticketId, actions: [{ type, summary }] }` |
| `GET /chat/history/:ticketId` | user | — | Same as `GET /tickets/:id/messages` (alias for frontend convenience) |

## 8. Users / health / docs

| Method & path | Auth | Notes |
|---|---|---|
| `GET /users/me` | user | Profile (alias of `/auth/me`) |
| `GET /users` | admin | List users (minimal admin function) |
| `PATCH /users/:id/role` | admin | `{ role }` + audit event |
| `GET /health` | public | `{ status, db, aiMode }` |
| `GET /docs` | public | Swagger UI (from `templates/openapi/openapi.yaml`) |

## 9. Error envelope (all errors, no exceptions leak)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable", "details": [{ "field": "email", "message": "Invalid email" }] } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired JWT |
| 403 | `FORBIDDEN` | Authenticated but wrong role (staff-only route) |
| 404 | `NOT_FOUND` | Missing OR not-owned resource (customer) |
| 409 | `CONFLICT` | Duplicate email / idempotency replay with different payload |
| 422 | `BUSINESS_RULE` | Refund ineligible (expired window, not delivered, amount exceeds) |
| 429 | `RATE_LIMITED` | Rate limit hit |
| 500 | `INTERNAL` | Unexpected (message generic; detail in logs only) |

## 10. Validation rules (Zod — backend only; frontend mirrors for UX, never for security)

- `email`: valid email, max 254. `password`: 8–72 chars. `name`: 2–80 chars.
- `subject`: 5–120. `description`: 20–2000. `message content`: 1–2000.
- `amount`: number > 0, ≤ 10,000,000, 2dp. `reason`: 10–500 chars.
- `idempotencyKey`: UUID string, required on `POST /refunds`.
- Enums validated against §3 of `03-DATABASE-SCHEMA.md`. Unknown fields stripped (not errored) except on auth (strict).
