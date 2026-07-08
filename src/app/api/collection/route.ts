import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ReadStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.collectionEntry.findMany({
    where: { userId: auth.userId },
    include: { book: true },
  });

  const read = entries.filter((e) => e.status === "READ");
  const futureRead = entries.filter((e) => e.status === "FUTURE_READ");

  // READ: dated entries first (most recently read first), then undated
  // entries alphabetically by title.
  read.sort((a, b) => {
    if (a.dateRead && b.dateRead) return b.dateRead.getTime() - a.dateRead.getTime();
    if (a.dateRead && !b.dateRead) return -1;
    if (!a.dateRead && b.dateRead) return 1;
    return a.book.title.localeCompare(b.book.title);
  });

  // FUTURE_READ: most-recently-added first.
  futureRead.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({ entries: [...read, ...futureRead] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.isbn13 || !body?.volumeId || !body?.title) {
    return NextResponse.json({ error: "Missing book details" }, { status: 400 });
  }

  const {
    isbn13,
    volumeId,
    title,
    authors,
    coverUrl,
    rating,
    publishedYear,
    pageCount,
    description,
    dateRead,
    review,
    status,
  } = body;

  if (status !== undefined && status !== "READ" && status !== "FUTURE_READ") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const readStatus: ReadStatus = status === "FUTURE_READ" ? "FUTURE_READ" : "READ";

  // Book cache row may not exist yet if this book was never searched/browsed
  // through the normal caching paths — upsert best-effort like other routes.
  try {
    await prisma.booksCache.upsert({
      where: { isbn13 },
      update: {},
      create: {
        isbn13,
        volumeId,
        title,
        authors: authors ?? [],
        coverUrl: coverUrl ?? null,
        rating: rating ?? null,
        publishedYear: publishedYear ?? null,
        pageCount: pageCount ?? null,
        description: description ?? null,
        sourcePayload: {},
      },
    });
  } catch (err) {
    console.error("Failed to ensure books_cache row before collection insert:", err);
    return NextResponse.json({ error: "Could not save book" }, { status: 500 });
  }

  try {
    const entry = await prisma.collectionEntry.create({
      data: {
        userId: auth.userId,
        isbn13,
        status: readStatus,
        dateRead: readStatus === "READ" && dateRead ? new Date(dateRead) : null,
        review: readStatus === "READ" && review ? review : null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Already in your collection" }, { status: 409 });
    }
    console.error("Failed to create collection entry:", err);
    return NextResponse.json({ error: "Could not save to collection" }, { status: 500 });
  }
}
