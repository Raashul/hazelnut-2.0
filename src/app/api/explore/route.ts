import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GENRES } from "@/lib/genres";

export async function GET() {
  try {
    const counts = await prisma.exploreBook.groupBy({
      by: ["genre"],
      _count: { _all: true },
    });
    const countByGenre = Object.fromEntries(counts.map((c) => [c.genre, c._count._all]));

    const genres = GENRES.map((g) => ({
      slug: g.slug,
      label: g.label,
      bookCount: countByGenre[g.slug] ?? 0,
    }));

    return NextResponse.json({ genres });
  } catch (err) {
    console.error("Failed to load explore genres:", err);
    return NextResponse.json({ error: "Failed to load genres" }, { status: 500 });
  }
}
