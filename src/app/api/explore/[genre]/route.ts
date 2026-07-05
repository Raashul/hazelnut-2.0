import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGenreBySlug } from "@/lib/genres";

const PAGE_SIZE = 60;

// Full catalog read (book_genres, not the curated explore_books selection) so
// "See all" can page through every active book tagged with this genre.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ genre: string }> }
) {
  const { genre: slug } = await params;

  const genre = getGenreBySlug(slug);
  if (!genre) {
    return NextResponse.json({ error: "Unknown genre" }, { status: 404 });
  }

  const pageParam = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  try {
    const where = { genre: slug, isActive: true };

    const [totalCount, bookGenres] = await Promise.all([
      prisma.bookGenre.count({ where }),
      prisma.bookGenre.findMany({
        where,
        include: { book: true },
        orderBy: [{ book: { rating: "desc" } }, { addedAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    const books = bookGenres.map((bg) => ({
      isbn13: bg.book.isbn13,
      volumeId: bg.book.volumeId,
      title: bg.book.title,
      authors: bg.book.authors,
      coverUrl: bg.book.coverUrl,
      rating: bg.book.rating,
      publishedYear: bg.book.publishedYear,
      pageCount: bg.book.pageCount,
      description: bg.book.description,
    }));

    return NextResponse.json({
      genre: { slug: genre.slug, label: genre.label },
      books,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    });
  } catch (err) {
    console.error(`Failed to load explore books for genre "${slug}":`, err);
    return NextResponse.json({ error: "Failed to load books" }, { status: 500 });
  }
}
