import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GENRES } from "@/lib/genres";

const PREVIEW_LIMIT = 12;

export async function GET() {
  try {
    const [counts, previewRows] = await Promise.all([
      prisma.exploreBook.groupBy({
        by: ["genre"],
        _count: { _all: true },
      }),
      prisma.exploreBook.findMany({
        include: { book: true },
        orderBy: { selectedAt: "desc" },
      }),
    ]);

    const countByGenre = Object.fromEntries(counts.map((c) => [c.genre, c._count._all]));

    const booksByGenre: Record<string, typeof previewRows> = {};
    for (const row of previewRows) {
      if (!booksByGenre[row.genre]) booksByGenre[row.genre] = [];
      if (booksByGenre[row.genre].length < PREVIEW_LIMIT) {
        booksByGenre[row.genre].push(row);
      }
    }

    const genres = GENRES.map((g) => ({
      slug: g.slug,
      label: g.label,
      bookCount: countByGenre[g.slug] ?? 0,
      books: (booksByGenre[g.slug] ?? []).map((eb) => ({
        isbn13: eb.book.isbn13,
        volumeId: eb.book.volumeId,
        title: eb.book.title,
        authors: eb.book.authors,
        coverUrl: eb.book.coverUrl,
        rating: eb.book.rating,
        publishedYear: eb.book.publishedYear,
        pageCount: eb.book.pageCount,
        description: eb.book.description,
      })),
    }));

    return NextResponse.json({ genres });
  } catch (err) {
    console.error("Failed to load explore genres:", err);
    return NextResponse.json({ error: "Failed to load genres" }, { status: 500 });
  }
}
