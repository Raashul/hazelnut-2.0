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

  return NextResponse.json({ inCollection: !!entry });
}
