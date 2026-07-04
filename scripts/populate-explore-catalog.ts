// Manually-triggered script: for each hardcoded genre, query OpenLibrary by
// subject and add new books to the explore catalog. Run with:
//   npm run explore:populate
//
// Duplicates (same isbn13 already tagged with the same genre) are left
// untouched — isActive/addedAt are not reset on a rerun.
import "dotenv/config";
import { GENRES } from "../src/lib/genres";
import { olDocToBook, OLSearchResponse, OL_SEARCH_FIELDS, OL_USER_AGENT } from "../src/lib/books";
import { prisma } from "../src/lib/prisma";

const RESULTS_PER_GENRE = 100;
const MIN_RATING = 1;
const THROTTLE_MS = 350; // keeps us under OpenLibrary's 3 req/sec tier

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGenreBooks(olSubject: string) {
  const url =
    `https://openlibrary.org/search.json` +
    `?q=${encodeURIComponent(`subject:${olSubject}`)}` +
    `&fields=${OL_SEARCH_FIELDS}` +
    `&limit=${RESULTS_PER_GENRE}`;

  const res = await fetch(url, { headers: { "User-Agent": OL_USER_AGENT } });
  if (!res.ok) {
    throw new Error(`OpenLibrary request failed for subject "${olSubject}": ${res.status}`);
  }
  const data: OLSearchResponse = await res.json();
  return data.docs ?? [];
}

async function main() {
  for (const genre of GENRES) {
    console.log(`\n[${genre.slug}] querying OpenLibrary subject "${genre.olSubject}"...`);

    let docs;
    try {
      docs = await fetchGenreBooks(genre.olSubject);
    } catch (err) {
      console.error(`[${genre.slug}] fetch failed, skipping genre:`, err);
      continue;
    }

    let added = 0;
    let alreadyTagged = 0;
    let skippedLowRating = 0;

    for (const doc of docs) {
      const book = olDocToBook(doc);

      if (book.rating == null || book.rating <= MIN_RATING) {
        skippedLowRating++;
        continue;
      }

      // Mirror the existing books_cache convention (see api/search/route.ts):
      // fall back to the OpenLibrary volumeId when no clean ISBN-13 exists.
      // OpenLibrary's isbn[] array isn't guaranteed stable across requests,
      // so this locally-computed value can drift from what's actually
      // persisted for this volumeId on a rerun — always read back the row's
      // real isbn13 from the upsert result rather than trusting this value
      // for anything downstream.
      const fallbackIsbn13 = book.isbn13 ?? book.volumeId;

      const cached = await prisma.booksCache.upsert({
        where: { volumeId: book.volumeId },
        update: {},
        create: {
          isbn13: fallbackIsbn13,
          volumeId: book.volumeId,
          title: book.title,
          authors: book.authors,
          coverUrl: book.coverUrl,
          rating: book.rating,
          publishedYear: book.publishedYear,
          pageCount: book.pageCount,
          description: book.description,
          sourcePayload: {},
        },
      });
      const isbn13 = cached.isbn13;

      const existingTag = await prisma.bookGenre.findUnique({
        where: { isbn13_genre: { isbn13, genre: genre.slug } },
      });

      if (existingTag) {
        alreadyTagged++;
        continue;
      }

      await prisma.bookGenre.create({
        data: { isbn13, genre: genre.slug, isActive: true },
      });
      added++;
    }

    console.log(
      `[${genre.slug}] added ${added}, already tagged ${alreadyTagged}, skipped (rating <= ${MIN_RATING}) ${skippedLowRating}`
    );

    await sleep(THROTTLE_MS);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Population script failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
