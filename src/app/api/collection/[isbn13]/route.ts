import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ isbn13: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isbn13 } = await params;

  const entry = await prisma.collectionEntry.findUnique({
    where: { userId_isbn13: { userId: auth.userId, isbn13 } },
  });

  return NextResponse.json({
    status: entry?.status ?? null,
    dateRead: entry?.dateRead ?? null,
    review: entry?.review ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ isbn13: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isbn13 } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { dateRead, review } = body;

  try {
    const entry = await prisma.collectionEntry.update({
      where: { userId_isbn13: { userId: auth.userId, isbn13 } },
      data: {
        dateRead: dateRead ? new Date(dateRead) : null,
        review: review || null,
      },
    });
    return NextResponse.json({ entry });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: "Not in your collection" }, { status: 404 });
    }
    console.error("Failed to update collection entry:", err);
    return NextResponse.json({ error: "Could not update entry" }, { status: 500 });
  }
}
