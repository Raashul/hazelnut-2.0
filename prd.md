# Product Requirements Document — Personal Library

**Product:** A personal library for books — your past reads and your future reads
**Status:** Draft v1
**Last updated:** June 28, 2026

---

## 1. Summary

A mobile-first app where a person can look up any book, read an at-a-glance picture of it (cover, rating, author, and curated reviews/quotes from notable people or publications), and save it to a personal collection as either a *future read* or an *already read*. The collection is the heart of the product: a private library of what you've read and what you intend to read, annotated with your own notes, ratings, and dates.

The product has three surfaces: **Home (search & discover a single book)**, **Collection (your saved library)**, and **Explore (browse/discovery — scoped below as proposals)**.

The defining technical constraints are **speed** (book metadata must render before the slower LLM enrichment finishes) and **cost** (the LLM call is the expensive operation, so results are cached aggressively and re-served from the database on repeat lookups).

---

## 2. Goals & non-goals

### Goals
- Let a user find a specific book and see trustworthy, sourced reviews/quotes in seconds.
- Let a user build and maintain a private library of past and future reads with personal annotations.
- Keep perceived latency low: never block the UI on the LLM.
- Keep per-lookup cost low by caching and never paying twice for the same book.
- Feel modern, clean, and simple on a phone — not flashy.

### Non-goals (v1)
- Social features (sharing, following, public profiles).
- In-app reading or e-book storage.
- Purchasing/affiliate flows.
- Recommendation ML beyond what's proposed for Explore.

---

## 3. Target user

A reader who wants one place to (a) quickly vet a book before reading it and (b) keep a personal record of their reading life. The collection is **private and personal** — its value is the user's own notes, not the LLM content.

> **Assumption (needs confirmation):** "Your collection" implies per-user accounts. v1 requires lightweight authentication (e.g., email magic link or OAuth) so collections are scoped to a user. Search/enrichment caching is global and shared across all users; collection data is per-user.

---

## 4. Information architecture

| Page | Purpose | Auth required |
|------|---------|---------------|
| **Home** | Search for a book; view metadata + sourced reviews; save to collection. | No (browse), Yes (save) |
| **Collection** | Your private library of future + already-read books, with your own notes/ratings/dates. | Yes |
| **Explore** | Browse and discover (proposals in §8). | No |

Primary navigation is a bottom tab bar (mobile convention): Home · Explore · Collection.

---

## 5. Home page (search & enrichment)

### 5.1 User-facing behavior
1. A prominent search bar sits at the top.
2. The user types a query (title, author, ISBN) and submits.
3. **Book metadata returns fast** from the Google Books API and renders immediately: cover image, title, author(s), rating, publication year, page count, description.
4. **Reviews/quotes from notable people or publications** are produced by the LLM and stream into the page *after* metadata is already on screen, into a clearly delineated "What people say" section showing a loading state until ready.
5. The user can save the book to their collection as **Future read** or **Already read** (see §6).

### 5.2 Single-result vs. multi-result logic
This rule governs when the expensive LLM call fires:

- **0 results** → empty state ("No books found"), no LLM call.
- **Exactly 1 result** → render that book and **automatically trigger LLM enrichment** for it.
- **More than 1 result** → render a results **list** (cover, title, author, rating per row) using **Google Books data only — no LLM call**. The LLM is triggered **only when the user taps a specific book** from the list, opening its detail view.

This ensures the LLM is never invoked for an ambiguous query, only for a single, committed book selection.

### 5.3 Asynchronous delivery (fast UX)
The two calls are decoupled so metadata never waits on the LLM.

```
Client submits query
        │
        ▼
[GET /search?q=...] ──► Google Books API ──► returns list/metadata  ◄── renders immediately
        │
        ▼ (only if 1 result, or on book tap)
[trigger enrichment for {book_id}]
        │
        ▼
Reviews delivered to UI when ready:
  Option A (recommended): Server-Sent Events / streaming endpoint pushes
    the enrichment payload to the open detail view.
  Option B: Client immediately calls GET /book/{id}/reviews, which long-
    polls / returns when enrichment completes (with a job/202 pattern).
```

**Recommendation:** SSE (or a streaming response on a `/book/{id}/reviews` endpoint) so the "What people say" section fills in live with a loading placeholder. The metadata response should include an `enrichment_status` field (`cached` | `pending` | `unavailable`) so the client knows whether to show the loader.

### 5.4 Caching & cost optimization (core requirement)
Two distinct cache layers, both backed by the database (with an optional in-memory/Redis hot tier):

**Layer 1 — Query → results cache.**
Maps a normalized search string (lowercased, trimmed, whitespace-collapsed) to the Google Books result set. Avoids repeat Books API calls for the same query. Moderate TTL (e.g., 30 days) since rankings/availability drift.

**Layer 2 — Book → enrichment cache (the important one).**
Keyed on **ISBN-13** as the primary key, with the Google Books `volumeId` as a fallback for editions lacking an ISBN-13. Stores the book metadata **and** the LLM enrichment payload. Because notable quotes about a book don't change, this layer is effectively **permanent (no TTL)** — once a book is enriched, it is never re-sent to the LLM.

**Lookup order on any enrichment request:**
```
1. Resolve query → ISBN-13 (via Books API or Layer 1 cache)
2. Check Layer 2 by ISBN-13:
     HIT  → serve cached enrichment, $0 LLM cost
     MISS → call LLM, validate (§5.5), write to Layer 2, serve
```

Because the LLM call is the dominant cost, the design target is: **any given book is enriched by the LLM at most once, ever, across all users.** Repeat searches — by the same or any other user — are served entirely from the database.

> **Edge case:** Different editions of the same work have different ISBN-13s. To avoid re-enriching every edition, store an optional `work_id` (e.g., derived from normalized title+author, or an OpenLibrary work key) and let editions share a single enrichment record. Decision flagged as open (§10).

### 5.5 LLM authenticity requirements (must-have)
The single biggest product risk is the LLM **fabricating** quotes or sources. These requirements are mandatory:

- The LLM must return **structured output**, one object per review/quote:
  `{ quote_text, attributed_to, source_name, source_url, source_date, confidence }`.
- Every quote **must carry a real, named source** (a publication or a named person) and, wherever possible, a resolvable `source_url`. Quotes without a source are dropped.
- Prefer **web-search-grounded generation** (tool/retrieval-augmented) over pure parametric recall, so quotes are pulled from real sources rather than the model's memory.
- A **validation step** runs before caching: verify the `source_url` resolves and plausibly matches the attribution; below a confidence threshold the item is either labeled "Unverified" in the UI or excluded entirely.
- **Never fabricate.** If no credible sourced reviews are found, return an empty set and the UI shows "No notable reviews found yet" rather than inventing content.
- The UI displays the source name (and links the URL) alongside each quote so the user can verify it themselves.

---

## 6. Collection page (your private library)

### 6.1 Purpose
A personal library of saved books. **The LLM enrichment is never shown here** — the collection is yours, built around *your* relationship with each book.

### 6.2 Saving a book
From a book's detail view, the user saves it as one of:
- **Future read** — a book they intend to read.
- **Already read** — a book they've finished; they may add a short personal note (their own review).

### 6.3 The "bookmark" (saved entry)
Each saved book is a *bookmark* the user can open and edit. Fields:

| Field | Future read | Already read |
|-------|-------------|--------------|
| Book title (+ cover, author) | ✓ | ✓ |
| Status | ✓ | ✓ |
| Personal note / review | optional | ✓ (the point) |
| Personal rating | optional | optional |
| Date read | — | optional |
| Date added | auto | auto |
| Tags (optional) | optional | optional |

### 6.4 Page behavior
- Two views/filters: **Future reads** and **Already read** (e.g., segmented control at top).
- Each row shows **the book title and the user's own review/note** (and cover + personal rating where present). No external reviews, no LLM text.
- Tapping a row opens the editable bookmark detail.
- Standard actions: edit, change status (e.g., move Future → Already read), delete.

---

## 7. Data model (illustrative)

```
books_cache            // global, shared
  isbn13          PK
  volume_id
  work_id?              // optional, groups editions
  title
  authors[]
  cover_url
  rating
  published_year
  page_count
  description
  source_payload  json // raw Books API response

enrichment_cache       // global, shared, permanent
  isbn13          FK -> books_cache   // or work_id
  reviews         json // [{quote_text, attributed_to, source_name, source_url, source_date, confidence, verified}]
  generated_at

query_cache            // global, shared, TTL ~30d
  normalized_query PK
  result_ids[]    // ordered volume_ids / isbn13s
  cached_at

users
  user_id         PK
  ...auth fields

bookmarks              // per-user, private
  bookmark_id     PK
  user_id         FK
  isbn13          FK -> books_cache
  status          enum(future_read, already_read)
  personal_note   text
  personal_rating int?
  date_read       date?
  tags[]
  created_at
  updated_at
```

---

## 8. Explore page (proposals — for decision)

Marked TBD in the brief. Below are candidate directions, ranked. **None is committed.** Recommend picking 1–2 for v1.

1. **Curated lists & shelves (lowest cost, recommended for v1).** Editorial or rules-based collections — "Most-saved this month," "Award winners," "Staff/seed lists by genre." Driven by Books API + the existing cache, no new per-user ML. Tapping any book opens the same detail view (and reuses enrichment cache).
2. **Browse by category/genre.** Genre grid → list views powered by Books API queries, cached via Layer 1. Cheap, useful, mobile-friendly.
3. **Personalized "Because you saved…".** Lightweight recommendations from the user's collection (shared authors/genres/tags). More valuable but needs a recommendation rule and per-user computation.
4. **Trending from collection data.** Aggregate, anonymized "what people are adding" — only viable once there's a user base; raises privacy questions.

**Open question:** What's the primary job of Explore — *discover new books* or *re-engage with my own library*? That choice drives which proposal wins.

---

## 9. Non-functional requirements

- **Performance:** Book metadata visible in well under ~1s on a typical mobile connection (cache hit) / dominated by Books API latency (cache miss). LLM enrichment must never block metadata render.
- **Cost:** Each unique book enriched by the LLM at most once, ever. Cache-hit lookups cost $0 in external API spend beyond infra.
- **Mobile-first:** Designed for phone screens first; bottom-tab navigation; thumb-reachable primary actions; responsive up to larger screens.
- **Reliability:** If the LLM is slow or fails, the page still works — metadata and save flow are unaffected; reviews section degrades gracefully.
- **Privacy:** Collection data is private to the user and never exposed in shared/global caches.

---

## 10. Open questions

1. **Auth:** Confirm account model (magic link vs. OAuth vs. anonymous-with-upgrade).
2. **Edition de-duplication:** Should enrichment be keyed per ISBN-13 or per *work* (shared across editions)? Affects cost and the `work_id` design.
3. **Async transport:** SSE vs. polling vs. 202+job for delivering enrichment.
4. **Explore scope:** Which proposal(s) from §8, and what is Explore's primary job?
5. **Verification strictness:** Do we *exclude* unverifiable quotes or *label* them "Unverified"?
6. **Ratings source:** Google Books ratings are sparse; consider a secondary source (e.g., OpenLibrary) if coverage is poor.

---

## 11. Design principles

- **Simple over flashy.** Clean type, generous spacing, restrained color, a single accent. No gratuitous animation or "glitter."
- **Content-first.** Cover and title lead; chrome recedes.
- **Fast-feeling.** Skeleton/loading states for the async reviews section so the page feels alive while it fills in.
- **Calm, library-like tone.** This is a personal, quiet space for one reader — the collection should feel like *yours*.

---

## 12. Out of scope (v1)

Social/sharing, in-app reading, purchasing, multi-device offline sync, and any recommendation system beyond the chosen Explore proposal.
