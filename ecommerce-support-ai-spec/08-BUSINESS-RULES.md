# 08 — Business Rules & Guardrails

## 1. Refund eligibility (evaluated in `RefundService.validateEligibility` — single source of truth)

| # | Check | Fail → outcome |
|---|---|---|
| R1 | Order exists AND `order.customerId == requester` | 404 `NOT_FOUND` (no leak) |
| R2 | `order.status == DELIVERED` | 422 `BUSINESS_RULE` "Order has not been delivered" |
| R3 | `daysSinceDelivery ≤ 14` (return window) | 422 + policy explanation; refund `REJECTED` if created via agent |
| R4 | `0 < amount ≤ refundableAmount` where `refundable = totalAmount − Σ(active refunds)` | 422 "Amount exceeds refundable balance" |
| R5 | No existing refund for order with status `PENDING_REVIEW/APPROVED/ESCALATED/PROCESSED` | 409 `CONFLICT` (duplicate) |
| R6 | `idempotencyKey` unique; replay with same key + same payload → return existing refund (200, no new row) | 409 if same key, different payload |
| R7 | `amount > ₹5,000` | Create refund `ESCALATED` + `Escalation` (priority HIGH); **do not execute** |
| R8 | All pass + `amount ≤ ₹5,000` | Create refund `APPROVED` → execute via simulated payment → `PROCESSED` |

**Return window source:** `backend/policy/return-policy.md` (14 days, all categories; Electronics 14 days with original packaging note). Backend constant `RETURN_WINDOW_DAYS = 14` must match the policy doc — add a test asserting they agree.

## 2. Escalation matrix (when to escalate)

| Trigger | Escalation priority | Refund status |
|---|---|---|
| Amount > ₹5,000 | HIGH | `ESCALATED` |
| Customer asks for human | MEDIUM | unchanged |
| Policy conflict / ambiguous category | MEDIUM | `PENDING_REVIEW` |
| Tool/DB failure during refund | HIGH | `FAILED` (retryable) |
| Injection attempt detected | HIGH | unchanged (no refund created) |
| Staff manual escalate | as chosen | unchanged |

## 3. Guardrails (mandatory behaviors)

| Scenario | Expected behavior |
|---|---|
| Missing order ID | Ask for it; **do not call** order/refund tools |
| Invalid/inaccessible order | Safe error; never expose another customer's data |
| Expired window | Do not process; explain policy; record interaction |
| Amount > ₹5,000 | Escalate; do not auto-process |
| Duplicate / retry | Idempotency key prevents second transaction |
| Prompt injection ("ignore policy…") | Do not bypass; decline + offer escalation; audit log |
| Tool/DB failure | Graceful error; never claim success; retry safely or escalate |
| Refund execution failure | Status `FAILED`; customer sees failure + next steps; staff can retry |

## 4. State machines

**Refund:** `PENDING_REVIEW → APPROVED → PROCESSED | FAILED`; `PENDING_REVIEW → REJECTED`; `PENDING_REVIEW → ESCALATED → APPROVED → PROCESSED | REJECTED`. No other transitions (enforced in service).

**Ticket:** `OPEN → IN_PROGRESS → RESOLVED → CLOSED`; `OPEN/IN_PROGRESS → ESCALATED → IN_PROGRESS/RESOLVED`. Customer cannot reopen `CLOSED` (must create new ticket).

**Escalation decision:** `PENDING → APPROVED | REJECTED | NEEDS_INFO`. `NEEDS_INFO` → back to `PENDING` after customer reply (staff reopens).

## 5. Audit requirements

Log: `REFUND_REQUESTED`, `REFUND_APPROVED`, `REFUND_REJECTED`, `REFUND_EXECUTED`, `REFUND_FAILED`, `ESCALATION_CREATED`, `ESCALATION_DECIDED`, `TICKET_STATUS_CHANGED`, `LOGIN`, `ROLE_CHANGED`. Each with userId, entity, entityId, timestamp. Audit writes never block the main transaction (best-effort after commit).
