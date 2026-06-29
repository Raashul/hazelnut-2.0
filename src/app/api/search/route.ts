import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeQuery,
  olDocToBook,
  OLSearchResponse,
  OL_SEARCH_FIELDS,
  OL_USER_AGENT,
} from "@/lib/books";

const QUERY_CACHE_TTL_DAYS = 30;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const normalized = normalizeQuery(q);

  // Layer 1: query cache
  const cached = await prisma.queryCache.findUnique({
    where: { normalizedQuery: normalized },
  });

  if (cached) {
    const ageMs = Date.now() - cached.cachedAt.getTime();
    if (ageMs < QUERY_CACHE_TTL_DAYS * 86_400_000) {
      const books = await prisma.booksCache.findMany({
        where: { volumeId: { in: cached.resultIds } },
      });
      const byId = Object.fromEntries(books.map((b) => [b.volumeId, b]));
      const ordered = cached.resultIds.flatMap((id) => (byId[id] ? [byId[id]] : []));
      return NextResponse.json({ results: ordered, source: "cache" });
    }
  }

  // Fetch from OpenLibrary Search API
  const url =
    `https://openlibrary.org/search.json` +
    `?q=${encodeURIComponent(q)}` +
    `&fields=${OL_SEARCH_FIELDS}` +
    `&limit=10` +
    `&lang=eng`;

  const res = await fetch(url, {
    headers: { "User-Agent": OL_USER_AGENT },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "OpenLibrary API error" }, { status: 502 });
  }

  const data: OLSearchResponse = await res.json();
  const docs = data.docs ?? [];

  if (docs.length === 0) {
    return NextResponse.json({ results: [], source: "api" });
  }

  const books = docs.map(olDocToBook);

  // Upsert into books_cache — use volumeId (OL work key) as the unique key
  await Promise.all(
    books.map((book) =>
      prisma.booksCache.upsert({
        where: { volumeId: book.volumeId },
        update: {
          // Refresh metadata on cache hit in case it improved
          title: book.title,
          authors: book.authors,
          coverUrl: book.coverUrl,
          rating: book.rating,
          publishedYear: book.publishedYear,
          pageCount: book.pageCount,
        },
        create: {
          isbn13: book.isbn13 ?? book.volumeId,
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
      })
    )
  );

  const resultIds = books.map((b) => b.volumeId);

  // Write / refresh query cache
  await prisma.queryCache.upsert({
    where: { normalizedQuery: normalized },
    update: { resultIds, cachedAt: new Date() },
    create: { normalizedQuery: normalized, resultIds },
  });

  const freshBooks = await prisma.booksCache.findMany({
    where: { volumeId: { in: resultIds } },
  });
  const byId = Object.fromEntries(freshBooks.map((b) => [b.volumeId, b]));
  const ordered = resultIds.flatMap((id) => (byId[id] ? [byId[id]] : []));

  return NextResponse.json({ results: ordered, source: "api" });
}
