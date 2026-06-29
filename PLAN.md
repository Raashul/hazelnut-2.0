# Hazelnut App — Build Plan

_Last updated: 2026-06-28_

---

## Phase 1 — Project Scaffold + Data Layer ✅ DONE

**Goal:** Next.js running, Prisma schema defined, Supabase connected, env vars documented.

### Tasks
- [x] Initialize Next.js (TypeScript, Tailwind, App Router, src/ dir)
- [x] Install additional dependencies (Prisma, Supabase, bcryptjs, jose, openai, @prisma/adapter-pg)
- [x] Initialize Prisma + connect to Supabase (prisma.config.ts configured)
- [x] Write full Prisma schema (all 5 tables)
- [x] Create `.env.example` with all required vars
- [x] `next build` compiles clean
- [x] `.env` filled with real credentials
- [x] `prisma db push` synced schema to Supabase

### Success Criteria
- [x] `next build` compiles clean
- [x] Prisma schema includes: `books_cache`, `enrichment_cache`, `query_cache`, `users`, `bookmarks`
- [x] `enrichment_cache` has `verification_status` (per review), `status`, `retry_count`, `failed_at`
- [x] `.env.example` documents all required environment variables
- [x] `prisma db push` applied successfully

---

## Phase 2 — Auth System ✅ DONE

**Goal:** Username/password auth, bcrypt hashing, JWT in localStorage, route protection.

### Tasks
- [x] `POST /api/auth/register` — create user, hash password with bcrypt
- [x] `POST /api/auth/login` — validate credentials, return signed JWT
- [x] Auth helper: `verifyJWT(token)` utility
- [x] Login page (`/login`)
- [x] Register page (`/register`)
- [x] Auth context / hook for client-side token management
- [x] `/collection` layout — client-side redirect if unauthenticated

### Success Criteria
- [x] Register creates user with bcrypt-hashed password in DB
- [x] Login returns JWT on valid credentials, 401 on invalid
- [x] `/collection` redirects unauthenticated users to `/login`
- [x] `/` (Home) and `/explore` accessible without token

---

## Phase 3 — Home Page (Search + Enrichment Pipeline) ✅ DONE

**Goal:** Search → Books API metadata → SSE streams enrichment. Full caching. Fail states.

### Tasks
- [ ] `GET /api/search?q=` — Google Books API query, Layer 1 cache (query_cache)
- [ ] `GET /api/books/[id]` — fetch/cache single book metadata into books_cache
- [ ] `GET /api/books/[id]/reviews` — SSE endpoint: check enrichment_cache → trigger OpenAI if miss
- [ ] OpenAI Responses API call with web_search_preview tool
- [ ] Write enrichment result to enrichment_cache with `status: completed`
- [ ] Failed enrichment: write `status: failed`, increment `retry_count`, cap at 3
- [ ] Filter `verification_status: fake` reviews from all responses
- [ ] Home page UI: search bar, metadata card, "What people say" section with SSE loader
- [ ] Single result → auto-trigger enrichment SSE
- [ ] Multiple results → list view, SSE only on book tap
- [ ] 0 results → empty state

### Success Criteria
- [x] Single result: metadata renders, SSE auto-fires enrichment
- [x] Multiple results: list view, no LLM call until book tapped
- [x] Cache hit: enrichment from DB, no OpenAI call made
- [x] `fake` reviews excluded from responses
- [x] Failed enrichment: `status: failed` written, `retry_count` incremented, stops at 3
- [x] OpenAI failure: user sees "No notable reviews found yet", page still works

---

## Phase 4 — Responsive Design ✅ DONE

**Goal:** Make the app fully responsive — works well on mobile, tablet, and desktop/laptop. Not phone-only; not desktop-only. Comfortable at any viewport width.

**Context:** Originally scoped as "mobile-first." Revised to "responsive" — the app runs in a web browser and users will access it on laptops too. The layout should adapt gracefully across breakpoints, not just be squeezed to phone width.

### Tasks
- [ ] Set a sensible max-width container with centred layout on wide screens
- [ ] Bottom nav: stays bottom on mobile, moves to a top/sidebar nav on desktop (md+)
- [ ] Home page: two-column layout on desktop (search/results left, book detail right)
- [ ] Login / Register: already centred, verify they look right on desktop
- [ ] Collection page (when built): card grid on desktop, stacked list on mobile
- [ ] Explore page (when built): genre grid adapts columns to viewport width
- [ ] Verify no content is cut off or awkwardly stretched at any common breakpoint

### Success Criteria
- [ ] Looks correct and usable on 375px (iPhone SE), 768px (tablet), 1280px (laptop)
- [ ] Bottom nav collapses/transforms into appropriate desktop nav
- [ ] Home page uses available space on desktop rather than a narrow centred column
- [ ] Text, images, and cards scale naturally — no overflow, no tiny text, no awkward gaps

---

## Phase 5 — Migrate to OpenLibrary API ✅ DONE

**Goal:** Replace Google Books API with OpenLibrary across the entire search pipeline. Better coverage, no API key required.

**Context:** Google Books API has inconsistent coverage for independently published and niche books. OpenLibrary is free, no API key needed, and has broader indexing. Rate limit: 1 req/sec unauthenticated, 3 req/sec with a `User-Agent` header. Our query cache (30-day TTL) naturally limits repeated API calls.

**Key API facts:**
- Search: `https://openlibrary.org/search.json?q=...&fields=...&limit=10`
- Cover images: `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg`
- Work key (our new `volumeId`): `/works/OL12345W`
- ISBN-13: extracted from `isbn[]` array (13-digit entries starting with 978/979)
- Rate limit header: `User-Agent: hazelnut-app/1.0 contact@email.com`

### Tasks
- [ ] Update `src/lib/books.ts` — new OpenLibrary types + transformation function
- [ ] Update `src/app/api/search/route.ts` — replace Google Books call with OpenLibrary search
- [ ] Add `User-Agent` header to all OpenLibrary requests (3 req/sec tier)
- [ ] Update `.env.example` — remove `GOOGLE_BOOKS_API_KEY`, note OpenLibrary needs no key
- [ ] Verify search returns results and cover images render
- [ ] Verify enrichment SSE still works (uses `volumeId` which now holds the OL work key)

### Success Criteria
- [ ] Search returns results from OpenLibrary
- [ ] Cover images load from `covers.openlibrary.org`
- [ ] `volumeId` in DB now stores OL work key (e.g. `/works/OL123W`)
- [ ] No `GOOGLE_BOOKS_API_KEY` required
- [ ] Rate limit respected via `User-Agent` header

---

## Phase 6 — Collection Page

**Goal:** Save books, personal notes/ratings, edit/delete bookmarks, segmented filter view.

### Tasks
- [ ] `POST /api/bookmarks` — save book to collection (future_read | already_read)
- [ ] `GET /api/bookmarks` — list user's bookmarks (auth required)
- [ ] `PATCH /api/bookmarks/[id]` — edit note, rating, date, status
- [ ] `DELETE /api/bookmarks/[id]` — remove bookmark
- [ ] Save CTA on book detail (triggers auth prompt if unauthenticated)
- [ ] Collection page UI: segmented control (Future / Already Read), bookmark list
- [ ] Bookmark detail: editable note, personal rating, date read, tags
- [ ] Move Future → Already Read flow

### Success Criteria
- [ ] Save CTA → auth prompt if not logged in → saves after login
- [ ] Collection filters correctly by status
- [ ] Edit, status change, delete all persist to DB
- [ ] No LLM / enrichment content appears on Collection page

---

## Phase 7 — Explore Page

**Goal:** Hardcoded genre grid → Books API → book list → detail view (reuses Phase 3 flow).

### Tasks
- [ ] Define hardcoded genre list
- [ ] `GET /api/explore/[genre]` — Books API category query, Layer 1 cached
- [ ] Explore page UI: genre grid
- [ ] Genre detail: book list (cover, title, author, rating)
- [ ] Tapping a book → detail view with enrichment SSE (same as Home)

### Success Criteria
- [ ] Genre grid renders all hardcoded genres
- [ ] Tapping genre shows book list (Books API, cached)
- [ ] Tapping book opens detail + triggers enrichment SSE

---

## Future TODOs (out of scope for v1)

- [ ] Admin UI for human-in-the-loop review (Verified / Fake marking)
- [ ] Upgrade auth to Supabase Auth or Clerk (replace self-built system)
- [ ] Migrate JWT from localStorage to httpOnly cookies
- [ ] work_id edition grouping (reduce LLM cost across editions)
- [ ] OpenLibrary as ratings fallback
- [ ] Upgrade Google Books to paid API key
- [ ] Post-login redirect back to book detail (after anonymous user hits auth wall)

---

## Key Decisions (from design review)

| Decision | Choice |
|----------|--------|
| Frontend | Next.js (web app, mobile-first responsive) |
| Backend | Next.js API Routes (monorepo) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Self-built username/password, bcrypt, JWT in localStorage |
| LLM | OpenAI Responses API + web_search_preview |
| Enrichment cache key | Per ISBN-13 |
| Enrichment validation | Unverified/Verified/Fake; human review via Supabase dashboard |
| Failed enrichment | status: failed, max 3 retries |
| Deployment | Vercel Pro, maxDuration=300 on enrichment route |
| Explore | Browse by genre, hardcoded genre list |
