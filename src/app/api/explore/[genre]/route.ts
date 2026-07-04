import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGenreBySlug } from "@/lib/genres";

// Pure internal read — the displayed selection is pre-computed by
// scripts/refresh-explore-selection.ts. No live OpenLibrary call happens here.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ genre: string }> }
) {
  const { genre: slug } = await params;

  const genre = getGenreBySlug(slug);
  if (!genre) {
    return NextResponse.json({ error: "Unknown genre" }, { status: 404 });
  }

  try {
    const exploreBooks = await prisma.exploreBook.findMany({
      where: { genre: slug },
      include: { book: true },
      orderBy: { selectedAt: "desc" },
    });

    const books = exploreBooks.map((eb) => ({
      isbn13: eb.book.isbn13,
      volumeId: eb.book.volumeId,
      title: eb.book.title,
      authors: eb.book.authors,
      coverUrl: eb.book.coverUrl,
      rating: eb.book.rating,
      publishedYear: eb.book.publishedYear,
      pageCount: eb.book.pageCount,
      description: eb.book.description,
    }));

    return NextResponse.json({ genre: { slug: genre.slug, label: genre.label }, books });
  } catch (err) {
    console.error(`Failed to load explore books for genre "${slug}":`, err);
    return NextResponse.json({ error: "Failed to load books" }, { status: 500 });
  }
}
