# Denga Design System

Enterprise design language for the Denga insurance platform. Target feel: **premium,
minimal, trustworthy, fast** — quality bar set by Linear / Stripe / Mercury.
Generated with ui-ux-pro-max design intelligence (variance 2 · motion 3 · density 8)
and adapted to the shipped product.

**Prime directive:** design changes never touch backend logic, APIs, Prisma schema,
routing, auth or business rules. Presentation only.

---

## 1. Foundations

### Typography
- **Family:** Geist Sans (self-hosted via `next/font`, `--font-geist-sans`); Geist Mono for code/refs where needed.
- **Scale:** 12 (meta) · 14 (body/UI default) · 16 (portal body) · 20 (section) · 24 (page title) · 30 (display, login brand panel only).
- **Weights:** 400 body · 500 labels/buttons · 600 headings/titles. Never 900.
- **Rules:** `tracking-tight` on titles ≥20px; `tabular-nums` for all counts, money and dates in tables; line-height ≥1.5 for body copy.

### Color
Tailwind palette is the primitive layer; semantics below are the only sanctioned uses.

| Token | Value | Use |
|---|---|---|
| Ink | `slate-900` | Headings, primary buttons |
| Body | `slate-700` | Body text |
| Muted | `slate-500` | Secondary text, labels |
| Faint | `slate-400` | Meta text, empty notes |
| Surface | `white` | Cards |
| Canvas | `slate-50` | App background |
| Chrome | `slate-950` | Header/brand panel |
| Brand | `sky-700` (`--color-brand`, #0369a1) | Links, interactive accents (4.5:1 on white) |
| Brand mark | `sky-500/90` | Logo square only |
| Info | `blue-*` | Informational chips/counts |
| Success | `emerald-*` | Positive states |
| Warning | `amber-*` | Attention states |
| Danger | `red-*` | Errors, urgent, destructive |

Claim-status chip colors live in `src/lib/format.ts` (`STATUS_STYLES`) — frozen mapping,
reused everywhere a status renders. Anti-patterns: AI purple/pink gradients, playful
pastels, color-only meaning (always pair icon/text).

### Spacing & Layout
- 4px rhythm. Common steps: 4 · 8 · 12 · 16 · 24 · 32.
- App container: `max-w-6xl px-6` (mobile `px-4`); page padding `py-8`.
- Dashboard density: card body `px-3 py-2.5`, card header `px-5 py-3`.

### Radius
- `rounded-lg` (8px): buttons, inputs, row hovers.
- `rounded-xl` (12px): small cards, message boxes.
- `rounded-2xl` (16px): primary cards/sections.
- `rounded-full`: chips, dots, avatars.

### Elevation
- Resting card: `border border-slate-200 shadow-sm` — borders carry hierarchy, shadows stay whisper-quiet.
- Overlay (modal/drawer, when built): `shadow-xl` + `bg-slate-950/50` scrim.
- Never stack heavy shadows; never elevate without a border.

### Iconography
- Heroicons 20 solid, inline SVG, `aria-hidden="true"`, sized `h-4 w-4` in 
  `h-7/8 w-7/8` tinted rounded squares (`bg-{tone}-50 text-{tone}-600`).
- One icon family, one stroke language. **No emoji as icons.**

### Motion
- Micro-interactions only: `transition` (150ms) on hover/focus states; `animate-spin` for loaders; `animate-pulse` for skeletons.
- Enter/exit ≤300ms, transform/opacity only. No decorative animation.
- `prefers-reduced-motion` globally respected (see `globals.css`).

### Accessibility floor
- Text contrast ≥4.5:1; focus ring on every interactive element
  (`focus-visible:ring-2`); labels on all inputs; `role="alert"` + icon on errors;
  touch targets ≥40px on mobile; keyboard-reachable everything.

---

## 2. Component Library (`src/components/ui/`)

| Component | File | Variants / Props |
|---|---|---|
| `Button`, `ButtonLink` | `Button.tsx` | variant: primary · secondary · danger · ghost · brand (blue, AI/intake actions); size: sm · md; `isLoading` spinner |
| `Badge` | `Badge.tsx` | tone: neutral · info · success · warning · danger · brand |
| `Card`, `CardHeader`, `CardBody` | `Card.tsx` | header: icon, title, count, accent, actions |
| `PageHeader` | `PageHeader.tsx` | title, subtitle, actions slot |
| `EmptyState` | `EmptyState.tsx` | title, description, action slot |
| `Skeleton` | `Skeleton.tsx` | className-sized pulse block |
| `Field`, `Input`, `Select`, `Textarea` | `Field.tsx` | label, error (`role="alert"`), helper text |
| `DengaMark` | `../DengaMark.tsx` | brand logo square |

Rules: components are presentational only; extend by adding variants, not one-offs;
if a pattern appears twice, promote it here.

---

## 3. Screen Pass Log (Fable redesign)

| # | Screen | Status | Commit |
|---|---|---|---|
| 1 | Login | ✅ shipped | `2b97008` |
| 2 | Dashboard + staff chrome | ✅ shipped | `f6db693` |
| 3 | Claims list | ✅ shipped | `283ed35` |
| 4 | Renewals | ✅ shipped | this commit |
| 5 | Claim detail | ✅ shipped (parts 1+2) | `18c84cd`, `e659b2a` |
| 6 | New claim | ✅ shipped | this commit |
| 7 | Client portal | pending | |
| 8 | Case file / share view | pending | |

Screens that don't exist yet (Clients, Quotes, Policies, Documents, Communication
Centre, Settings) adopt this system when their features are built.
