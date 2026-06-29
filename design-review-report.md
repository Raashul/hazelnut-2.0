# Design Review Report

**Document Reviewed:** Personal Library App — PRD v1 (prd.md)
**Review Date:** 2026-06-28
**Complexity Rating:** 🔴 High
**Reviewer Persona:** Senior Staff Engineer / Architect

---

## Executive Summary

The PRD is well-structured with clear scope, a sound caching strategy, and good instincts
around cost control and async delivery. The 12-question session resolved all major open
questions from §10 and filled several gaps the PRD left implicit. The biggest product risk —
LLM fabrication — has a workable v1 mitigation (Unverified/Verified/Fake + human review).
The deliberate simplifications (basic auth, per-ISBN-13 caching, no admin UI) are acceptable
tradeoffs, but two items need attention before this goes beyond personal use: JWT storage and
enrichment retry logic.

**Verdict:** ⚠️ Approved with Conditions

---

## Strengths

- **Two-layer caching is well-designed.** Query cache + enrichment cache with different TTLs
  is the right architecture. "Enrich once, serve forever" is a strong cost control principle.
- **Async delivery pattern is correct.** Decoupling Books API metadata from LLM enrichment
  means the user is never blocked. SSE on Next.js with Vercel Pro streaming is the right
  implementation path.
- **Fabrication risk is taken seriously.** The Unverified/Verified/Fake workflow with
  human-in-the-loop is pragmatic — it acknowledges the first-user risk honestly rather than
  pretending a prompt instruction solves hallucination.
- **Scope discipline.** The non-goals list and "v1 only" decisions are clear and well-reasoned.
  Explore page scoped to genre browsing only is correct.
- **Failure modes considered.** Failed enrichment state with 3-retry cap prevents unbounded
  API spend on books that consistently fail enrichment.

---

## Issues Identified

### 🔴 Critical (must fix before public launch)

- **JWT in localStorage**: XSS vulnerabilities — even minor ones — allow any injected script
  to exfiltrate all user session tokens. For a personal app this is an accepted risk; for
  any public launch, this must be migrated to httpOnly cookies before users with real
  reading data are onboarded.

### 🟡 Medium (should address before scaling)

- **No admin UI for human review**: The Verified/Fake workflow depends on direct Supabase
  dashboard access. This works for one operator but doesn't scale and has no audit trail.
  Build a minimal admin page before the reviewer is anyone other than you.
- **Per-ISBN-13 enrichment cost**: Different editions of the same book each trigger a
  separate OpenAI Responses API call. Acceptable for v1 but revisit if costs climb — a
  `work_id` grouping is the fix.
- **Google Books API quotas**: Free tier caps at 1,000 requests/day. Not a v1 problem but
  will need a paid API key before any real traffic.

### 🟢 Low (future considerations)

- **Responsive design scope updated**: Originally specified as "mobile-first." Revised during
  build to "responsive" — the app runs in a standard web browser and must work comfortably
  on desktop/laptop as well as mobile. Bottom nav, layout widths, and multi-column grids
  need explicit desktop breakpoints. Tracked as Phase 4 in PLAN.md.
- **No client-side cache**: Book cover images and metadata are re-fetched on every visit.
  A simple cache-control header or service worker would noticeably improve perceived
  performance on repeat visits.
- **OpenLibrary as ratings fallback**: §10.6 flags Google Books ratings as sparse. No
  decision was made on a secondary source — worth revisiting once real data shows gaps.
- **Anonymous session state**: If an anonymous user searches for a book and taps "Save",
  they get an auth prompt. After login, do they land back on that book or lose context?
  The post-login redirect flow wasn't specified.

---

## Q&A Summary

| #  | Question | Answer Summary | Status |
|----|----------|---------------|--------|
| 1  | LLM provider + web-search grounding + validation mechanism | OpenAI Responses API + web_search_preview tool. No second validation call. Reviews stored as `unverified`; human marks `verified` or `fake`. Fake entries excluded from API responses. | ✅ Resolved |
| 2  | Auth model + anonymous browsing support | Self-built username/password with bcrypt. JWT in localStorage. Anonymous browsing on Home/Explore; auth wall only at Collection. | ✅ Resolved |
| 3  | Frontend + backend + database tech stack | Next.js monorepo (web app, responsive — desktop + mobile). PostgreSQL on Supabase. Prisma as ORM. | ✅ Resolved |
| 4  | Database choice and ORM | Supabase (managed Postgres). Supabase JS client + Prisma. | ✅ Resolved |
| 5  | Which OpenAI capability for web-grounded generation | OpenAI Responses API with `web_search_preview` tool (not standard chat completions). | ✅ Resolved |
| 6  | Edition deduplication: per ISBN-13 vs per work | Per ISBN-13. Accept the cost of re-enriching different editions. No `work_id` in v1. | ✅ Resolved |
| 7  | Explore page scope | Browse by genre (proposal 2). Hardcoded genre list. Genre grid → Books API category queries → cached via Layer 1. | ✅ Resolved |
| 8  | Deployment + SSE timeout risk | Vercel Pro. `export const maxDuration = 300` on enrichment route. | ✅ Resolved |
| 9  | Admin interface for human-in-the-loop | No admin page in v1. Use Supabase dashboard directly. Flagged as future TODO. | ✅ Resolved |
| 10 | Enrichment failure handling + retry logic | Fail silently to user. Write `status: failed` + `failed_at` + `retry_count` to `enrichment_cache`. Max 3 retries, then stop. | ✅ Resolved |
| 11 | Session management: httpOnly cookie vs JWT in localStorage | JWT in localStorage. Security tradeoff acknowledged. Accepted for v1. | ✅ Resolved |
| 12 | Explore genre list: hardcoded vs dynamic | Hardcoded for v1. | ✅ Resolved |

---

## TBD / Unresolved Items

None — all questions were addressed during the review session.

---

## Decisions Confirmed

- **bcrypt** for password hashing (not MD5/SHA-256 without salt)
- **OpenAI Responses API + web_search_preview** for grounded enrichment (not standard completions)
- **Per ISBN-13** as the enrichment cache key (no work_id deduplication in v1)
- **Unverified/Verified/Fake** verification_status on enrichment records; Fake filtered on read
- **Max 3 retries** for failed enrichments with `retry_count` and `failed_at` tracking
- **Vercel Pro** with `maxDuration = 300` on the SSE enrichment route
- **Supabase dashboard** for human review — no admin UI in v1
- **Hardcoded genre list** for Explore page
- **Anonymous browsing** on Home and Explore; auth required only for Collection
- **JWT in localStorage** with full awareness of the XSS tradeoff

---

## Updated Data Model

Reflecting all decisions made during this session:

```
enrichment_cache
  isbn13              FK -> books_cache
  reviews             json  -- [{quote_text, attributed_to, source_name, source_url,
                              --   source_date, confidence, verification_status}]
  status              enum(pending, completed, failed)   -- NEW
  retry_count         int default 0                      -- NEW
  failed_at           timestamp?                         -- NEW
  generated_at        timestamp

-- verification_status on each review object (not the cache row):
--   unverified | verified | fake
-- Fake reviews are excluded from all API responses at query time.
```

---

## Open Questions / Action Items

- [ ] **Admin review UI** — build before the human reviewer is anyone other than the developer
- [ ] **Migrate JWT to httpOnly cookies** before any public launch beyond personal use
- [ ] **Post-login redirect** — after anonymous user hits auth wall mid-flow, return them to the book they were viewing
- [ ] **OpenLibrary ratings fallback** — evaluate Google Books rating coverage after launch and add secondary source if sparse
- [ ] **Google Books API paid key** — upgrade from free tier (1,000 req/day) before real traffic
- [ ] **work_id edition grouping** — revisit if per-ISBN-13 enrichment costs become significant
- [ ] **Upgrade auth** — replace self-built username/password with a proper provider (Supabase Auth, Clerk) in v2

---

## Recommendation

This design is ready to build with the decisions locked in above. Start with the data model
and API routes (enrichment pipeline first — it's the riskiest piece), then Home page search
flow, then Collection, then Explore. Resolve the post-login redirect flow before wiring up
the save CTA — it's easy to get wrong and annoying to fix later.

The JWT/localStorage decision is the one thing I'd revisit earliest — not because it's
urgent for a personal app, but because migrating sessions after users have data is painful.
