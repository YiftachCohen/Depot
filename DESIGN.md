# Design System — Depot

## Product Context
- **What this is:** The AI team manager's tool shed — a desktop app for managing specialized agents that handle non-coding cognitive overhead (logs, PM, scheduling, research, customer context)
- **Who it's for:** Small technical teams who need agents as teammates, not tools. Engineering leads, founders, ops managers who want to delegate cognitive overhead to AI
- **Space/industry:** AI agent orchestration — but NOT competing with coding tools (Cursor) or project management (Linear). Those are data sources, not competitors. Closest peers: Dust.tt, Relevance AI, CrewAI — but none of them feel like a team hub
- **Project type:** Desktop app (Electron), skill-first dashboard as home screen

## Aesthetic Direction
- **Direction:** Friendly-Professional — warm and approachable without being cutesy
- **Decoration level:** Intentional — subtle texture and depth where it helps agents feel "alive" (soft shadows on agent cards, warm background tints). Not flat/clinical, not maximalist
- **Mood:** Checking in on teammates, not configuring software. Calm, inviting, something you'd keep open all day. Notion's warmth meets Linear's craft quality
- **Key insight:** Every competitor looks like a monitoring dashboard or workflow builder. Depot should feel like a team roster — agents have presence, personality, and expertise

## Agent Identity
- **Current (v1):** Line-style icons (Lucide / thin-stroke icon set) on soft colored backgrounds. Each agent gets a role-appropriate icon on a warm-tinted rounded rectangle. NOT native emoji — clean monochrome outline icons with consistent stroke weight
- **Icon style:** Thin stroke, geometric, monochrome (dark on light bg, light on dark bg). Matching the overall minimal-professional aesthetic
- **Color coding:** Each agent role gets a color from the palette (amber, green, blue, etc.) used as the avatar background tint
- **Future (v2):** Abstract face cards — Matisse/Headspace-inspired geometric compositions. Bold shapes (circles, triangles, rectangles) arranged to suggest a character with personality. Each agent gets a unique deterministic composition from their name/role. Generative, distinctive, ownable. Requires dedicated design work

## Typography
- **Display/Hero:** Satoshi — geometric warmth, has character without being quirky. Says "team tool" not "terminal"
- **Body:** Plus Jakarta Sans — friendly, readable, pairs beautifully with Satoshi
- **UI/Labels:** Plus Jakarta Sans (same as body)
- **Data/Tables:** Geist Mono — clean, modern, supports tabular-nums for aligned numbers
- **Code:** Geist Mono
- **Loading:** Satoshi via Fontshare CDN (`api.fontshare.com`), Plus Jakarta Sans and Geist Mono via Google Fonts
- **Scale:**
  - H1: 56px / weight 900 / line-height 1.05 / tracking -0.03em
  - H2: 32px / weight 700 / line-height 1.2 / tracking -0.02em
  - H3: 20px / weight 600 / line-height 1.3
  - H4: 16px / weight 600 / line-height 1.4
  - Body: 15px / weight 400 / line-height 1.65
  - Small: 14px / weight 400 / line-height 1.6
  - Caption: 13px / weight 400-600 / line-height 1.5
  - Mono label: 11-12px / weight 500 / tracking 0.08em / uppercase

## Color
- **Approach:** Balanced, warm palette — amber primary instead of the purple/blue every competitor uses
- **Primary:** `#D97706` (Amber 600) — warm, energetic, distinctly different from the competitive landscape
- **Primary scale:**
  - 50: `#FFFBEB`
  - 100: `#FEF3C7`
  - 200: `#FDE68A`
  - 400: `#FBBF24`
  - 500: `#F59E0B`
  - 600: `#D97706` (primary)
  - 700: `#B45309`
  - 800: `#92400E`
- **Neutrals:** Stone (warm grays, NOT zinc/slate)
  - 50: `#FAFAF9` (base background)
  - 100: `#F5F5F4` (sunken surfaces, sidebar)
  - 200: `#E7E5E4` (borders)
  - 400: `#A8A29E` (tertiary text)
  - 500: `#78716C`
  - 600: `#57534E` (secondary text)
  - 800: `#292524`
  - 900: `#1C1917` (primary text)
- **Semantic:**
  - Success: `#16A34A` (green-600)
  - Warning: `#CA8A04` (yellow-600)
  - Error: `#DC2626` (red-600)
  - Info: `#2563EB` (blue-600)
- **Dark mode:** Warm dark surfaces (`#1A1816` base, `#231F1D` surface), NOT pure black. Reduce saturation 10-20% on accent colors. Stone-tinted dark backgrounds maintain warmth

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — agents need room to breathe. This is NOT a data-dense monitoring tool
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout
- **Approach:** Grid-disciplined — clean card grid for agent roster, predictable navigation. Content (agents, sessions) provides visual variety, not the layout
- **Grid:** 12 columns, responsive breakpoints
- **Max content width:** 960px for content areas, full-width for dashboard/roster
- **Border radius:**
  - sm: 6px (small elements, buttons)
  - md: 10px (cards, inputs)
  - lg: 14px (panels, modals)
  - full: 9999px (pills, tags, badges)

## Motion
- **Approach:** Intentional — agents should feel responsive and present. Subtle entrance animations, smooth state transitions. Not bouncy/playful, but alive
- **Easing:**
  - Enter: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out, snappy entrance)
  - Exit: `ease-in`
  - Move: `cubic-bezier(0.45, 0, 0.55, 1)` (ease-in-out)
- **Duration:**
  - Micro: 50-100ms (hover states, toggles)
  - Short: 150-250ms (button feedback, small transitions)
  - Medium: 250-400ms (panel opens, card entrance)
  - Long: 400-700ms (page transitions, complex animations)
- **Agent presence:** Status dots pulse gently (2s ease-in-out infinite). Cards lift subtly on hover (translateY -1px + shadow). Entrance animations use fadeUp (12px translate + opacity)

## Component Patterns
- **Buttons:** Primary (amber-600 bg, white text), Secondary (surface bg, border, text), Ghost (transparent, text only), Destructive (red-600 bg)
- **Tags/Badges:** Pill-shaped (radius-full), colored background tint + darker text. Role colors: amber, green, blue, neutral
- **Agent cards:** Surface background, subtle border, hover lifts with amber border highlight + shadow. Avatar (line icon on colored bg) + name + skill + status dot + last action
- **Alerts:** Left-aligned icon + text, colored background tint + border matching semantic color
- **Inputs:** Surface bg, border, amber focus ring (3px rgba amber 12% opacity)

## Anti-patterns (never do)
- Purple/violet gradients as default accent
- 3-column feature grid with icons in colored circles
- Centered everything with uniform spacing
- Uniform bubbly border-radius on all elements
- Gradient buttons as primary CTA
- Generic stock-photo hero sections
- Cool gray neutrals (zinc, slate) — always use warm stone
- Native emoji for agent avatars — use line-style icons

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | Initial design system created | Created by /design-consultation based on product positioning as "AI team manager's tool shed" |
| 2026-03-22 | Amber primary over purple/blue | Every competitor (CrewAI, Dust, Relevance AI) uses purple/blue. Amber is warm, energetic, instantly differentiates |
| 2026-03-22 | Satoshi + Plus Jakarta Sans | Geometric warmth for display, friendly readability for body. Says "team tool" not "terminal" |
| 2026-03-22 | Comfortable spacing over data density | Agents are teammates you check on, not metrics you monitor. The app should feel calm and inviting |
| 2026-03-22 | Line icons for agent avatars (v1) | Clean, professional, ships today. Thin-stroke monochrome icons on soft colored backgrounds |
| 2026-03-22 | Abstract face cards deferred to v2 | Matisse-style geometric character compositions — needs dedicated design work to look right |
| 2026-03-22 | Warm stone neutrals, not cool grays | Reinforces the friendly team hub aesthetic. Warm surfaces feel inviting, cool surfaces feel clinical |
