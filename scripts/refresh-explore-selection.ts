// Manually-triggered script: for each genre, wipe and reinsert the displayed
// explore_books selection with a fresh weighted-random draw (weighted toward
// higher rating) from the active catalog pool. Run with:
//   npm run explore:refresh
//
// The underlying catalog (book_genres/isActive) is never touched here — only
// the displayed selection changes.
import "dotenv/config";
import { GENRES } from "../src/lib/genres";
import { prisma } from "../src/lib/prisma";

const SELECTION_SIZE = 40;

// Efraimidis-Spirakis weighted sampling without replacement: assign each item
// a key = random()^(1/weight), take the top-k keys. Higher weight biases the
// key closer to 1, so higher-rated books are more likely to be selected, but
// nothing is guaranteed — this is still a random draw, not a top-N sort.
function weightedSample<T>(items: T[], weight: (item: T) => number, k: number): T[] {
  const keyed = items.map((item) => ({
    item,
    key: Math.pow(Math.random(), 1 / weight(item)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map((k) => k.item);
}

async function main() {
  for (const genre of GENRES) {
    const pool = await prisma.bookGenre.findMany({
      where: { genre: genre.slug, isActive: true },
      include: { book: true },
    });

    if (pool.length === 0) {
      console.log(`[${genre.slug}] no active books in catalog, skipping refresh`);
      continue;
    }

    // Math.min naturally covers the "fewer than 30 available" case — the
    // whole pool is taken (weighting is moot when k === pool.length).
    const selectionCount = Math.min(SELECTION_SIZE, pool.length);
    const selection = weightedSample(pool, (bg) => bg.book.rating ?? 1, selectionCount);

    await prisma.$transaction([
      prisma.exploreBook.deleteMany({ where: { genre: genre.slug } }),
      prisma.exploreBook.createMany({
        data: selection.map((bg) => ({ genre: genre.slug, isbn13: bg.isbn13 })),
      }),
    ]);

    console.log(`[${genre.slug}] refreshed: ${selection.length}/${pool.length} active books selected`);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Refresh script failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
