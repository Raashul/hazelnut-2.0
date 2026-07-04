# Explore Page — Implementation Plan

_Companion to PLAN.md Phase 7. Derived from the 2026-07-03 design review (see `report.md`/artifact for the full Q&A)._

Worktree: `explore-genre-recommendations` (branch `worktree-explore-genre-recommendations`)

---

## 1. Prisma schema additions

Two new models, following the existing `@@map` snake_case convention in `prisma/schema.prisma`:

```prisma
model BookGenre {
  id        String   @id @default(cuid())
  isbn13    String
  genre     String
  isActive  Boolean  @default(true)
  addedAt   DateTime @default(now())

  book      BooksCache @relation(fields: [isbn13], references: [isbn13])

  @@unique([isbn13, genre])
  @@index([genre, isActive])
  @@map("book_genres")
}

model ExploreBook {
  id         String   @id @default(cuid())
  genre      String
  isbn13     String
  selectedAt DateTime @default(now())

  book       BooksCache @relation(fields: [isbn13], references: [isbn13])

  @@unique([genre, isbn13])
  @@index([genre])
  @@map("explore_books")
}
```

Add the inverse relations (`bookGenres`, `exploreBooks`) to `BooksCache`. Apply with `prisma db push`, matching how Phase 1 synced schema (no migration files in this project yet).

---

## 2. Genre list + OpenLibrary subject mapping

`src/lib/genres.ts` — hardcoded array, single source of truth for both the population script and the UI grid:

```ts
export const GENRES = [
  { slug: "fantasy", label: "Fantasy", olSubject: "fantasy" },
  { slug: "science-fiction", label: "Science Fiction", olSubject: "science_fiction" },
  { slug: "mystery", label: "Mystery", olSubject: "mystery" },
  // ...
] as const;
```

---

## 3. Population script (manual, not scheduled)

`scripts/populate-explore-catalog.ts`, run via `npm run explore:populate`.

Reuses existing helpers from `src/lib/books.ts` (`OL_SEARCH_FIELDS`, `OL_USER_AGENT`, `olDocToBook`) rather than reimplementing OpenLibrary parsing.

For each genre in `GENRES`:
1. Query `https://openlibrary.org/search.json?q=subject:{olSubject}&fields=${OL_SEARCH_FIELDS}&limit=100` with `OL_USER_AGENT` header.
2. Throttle requests — one request per genre per run is likely enough given `limit=100`, but if pagination is added later, cap concurrency at 1 and space calls ≥350ms apart to stay under 3 req/sec.
3. For each doc: convert with `olDocToBook`. Skip if `rating` is null or `rating <= 1`. If `isbn13` is null (no clean ISBN-13), fall back to the OpenLibrary `volumeId` as the key — this mirrors the existing convention already in `api/search/route.ts` (`isbn13: book.isbn13 ?? book.volumeId`), so behavior matches how the rest of the app already handles ISBN-less books.
4. Upsert into `BooksCache` (create if the ISBN/volumeId doesn't exist yet).
5. Upsert into `BookGenre` on `[isbn13, genre]` — this is the dedupe: if the row exists, do nothing (don't reset `isActive` or `addedAt`). This satisfies "duplicate books are not added."

---

## 4. Refresh script (manual, not scheduled)

`scripts/refresh-explore-selection.ts`, run via `npm run explore:refresh`.

For each genre:
1. Fetch the active pool: `BookGenre.findMany({ where: { genre, isActive: true } })` joined to `BooksCache` for rating.
2. Weighted-random selection: weight each candidate by `rating` (e.g. cumulative-weight sampling), draw up to 40 without replacement. If the pool has fewer than 30 books, just take the whole pool (per design review floor).
3. Replace `ExploreBook` rows for that genre: delete existing rows for `genre`, insert the new selection. Wrap the delete+insert in `prisma.$transaction([...])` — cheap to do and narrows (does not eliminate) the accepted race-condition risk flagged in the design review. Full fix (versioned swap) is explicitly deferred, not required for v1.

---

## 5. API routes

- `src/app/api/explore/route.ts` — `GET`, returns `GENRES` with a count of `ExploreBook` rows per genre (for the grid).
- `src/app/api/explore/[genre]/route.ts` — `GET`, reads `ExploreBook` where `genre = params.genre`, joined to `BooksCache`, returns the book list (cover, title, authors, rating, isbn13/volumeId). **No OpenLibrary call at request time** — pure internal read, per design review.

---

## 6. UI

- `src/app/explore/page.tsx` — genre grid, fetches `/api/explore`.
- `src/app/explore/[genre]/page.tsx` — book list for the genre, fetches `/api/explore/[genre]`. Cover, title, author, rating per PLAN.md success criteria.
- Tapping a book routes into the **same detail + enrichment SSE flow already used on Home** (`src/app/api/books/[id]/reviews/route.ts`, keyed by `volumeId`/`isbn13`) — check whether the detail view is currently a Home-page-local component vs. something reusable; extract into a shared component if it's currently coupled to Home's state, rather than duplicating it.

---

## 7. Manual verification (no test framework in this repo yet — verify by running it)

1. `npm run explore:populate` against the dev DB — confirm `BooksCache` and `BookGenre` rows appear, no duplicate `[isbn13, genre]` pairs on a second run.
2. `npm run explore:refresh` — confirm `ExploreBook` rows are replaced per genre (old rows gone, new ones present, ≤40 per genre).
3. `curl` both API routes, confirm shape and that no OpenLibrary call happens (check logs/network).
4. Load `/explore` in the browser: genre grid renders, tapping a genre shows the book list, tapping a book opens the detail view and enrichment SSE still fires exactly as it does from Home.

---

## Known deferred item (accepted risk, not a blocker)

Refresh's delete+insert is wrapped in a transaction per-genre (see §4) but the overall refresh across genres is still not atomic end-to-end, and even the per-genre transaction is a "good enough for now" mitigation, not a full fix. Explicitly accepted at current traffic scale per the design review — revisit if this gets concurrent production traffic.
