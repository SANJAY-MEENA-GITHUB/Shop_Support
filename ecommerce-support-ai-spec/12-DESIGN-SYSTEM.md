# 12 — Design System (Industrial Anchor)

> **Stated direction:** We commit to the **Industrial** anchor — pitch-black surface, monospace everywhere, 1px borders, one signal green. Support operations is a live queue; the UI should read like a ledger, not a marketing site. The safe pairing would be a soft SaaS dashboard (white cards, rounded corners, Inter). We reject that: mono + tabular numerals + hairline rules make ticket states scannable at a glance and honest about the data. **Differentiator — the Ticket Ledger:** every ticket, order, and refund is a mono ledger row with a folio ID, tabular amounts, and a signal dot for status. No cards, no shadows, no decoration.

## 1. Tokens (exact — `src/styles/tokens.css`)

```css
:root {
  --surface: #0B0C0A;
  --surface-2: #131511;
  --border: #2A2D2A;
  --text: #E8EAE8;
  --muted: #8A918A;
  --signal: #00E676;        /* primary accent: links, active states, APPROVED/PROCESSED */
  --signal-red: #FF3B30;    /* REJECTED / FAILED / errors only */
  --signal-amber: #FFB800;  /* ESCALATED / PENDING only */
  --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
  --radius: 0px;            /* no rounded corners, ever */
  --shadow: none;           /* flat; 1px borders only */
}
```

**Token fidelity rules:** No serif fonts. No proportional fonts. No warm paper. No grain. No shadows. No border-radius > 0. Every font-family declaration is mono. `font-variant-numeric: tabular-nums` on all numbers.

## 2. Typography

- Display + body: JetBrains Mono (Google Fonts). Sizes: 12 / 14 / 16 / 20 / 28. Line-height 1.5 body, 1.2 headings.
- Headings uppercase, letter-spacing 0.02em. Labels 11px uppercase muted. Amounts right-aligned tabular.

## 3. Components

- **Buttons:** 1px border, transparent bg, uppercase 12px. Primary = signal border + signal text (hover: signal bg, black text). Danger = red border/text. No filled gradients.
- **Inputs:** transparent bg, 1px border, mono 14px, focus = signal border. Labels above, 11px uppercase muted.
- **Badges:** 1px border in status color + colored dot (8px circle) + uppercase label. Color is never the only signal (label text always present).
- **Tables (ledger rows):** full-width, 1px row dividers, header 11px uppercase muted, hover = surface-2 bg. Folio IDs (`TKT-…`, `ORD-…`, `RFD-…`) in mono.
- **Chat:** customer messages right-aligned with signal left border; agent/staff left-aligned with border. Timestamps 11px muted. No avatars with fake photos.
- **Icons:** Lucide only (`lucide-react`). No unicode glyphs as icons. No emoji as icons.

## 4. Content discipline (from SKILL.md §2 — mandatory)

- Every string names real information or is authored content that knows what it is. **Forbidden:** fabricated telemetry, fake personas, filler mono-caps subtitles, `//` kickers, themed replacement of standard copy.
- Standard copy for standard actions: "Sign in", "Sign out", "Create ticket", "Request refund", "Approve", "Reject", "Retry", "Loading…", "No open tickets".
- Empty states name the actual empty thing. Error states show the server message. No twee subcopy ("Ask the grid."), no synth-sci-fi status strips.
- Sample/seed data must be real seed data from the API (see `03` §5), never invented on the client.

## 5. Layout

- Header: 48px, bottom 1px border, logo text left ("ShopSupport"), nav center, user + Sign out right.
- Content max-width 1200px, 16px gutters. Detail pages: thread (flex 1) + context sidebar (320px) ≥ 1024px; stacked below.
- Grid: visible 1px rules between sections. Left-aligned type. No centered hero copy.

## 6. Motion

- 150ms ease transitions on hover/focus only. No spring physics, no parallax, no breathing animations. `prefers-reduced-motion` disables all transitions.

## 7. Pre-ship check (SKILL.md §5)

- [ ] Unexpected pairing held (Industrial, not generic SaaS)?
- [ ] Every token inside Industrial range (no serif, no radius, no shadow)?
- [ ] Every label names real info; standard copy; no filler/fabrication?
- [ ] Ticket Ledger differentiator visible on every list page?
- [ ] One anchor held (no "Industrial with Swiss edge")?
