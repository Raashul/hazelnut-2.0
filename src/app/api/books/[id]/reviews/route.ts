import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 300;

const MAX_RETRIES = 3;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const volumeId = decodeURIComponent(rawId);

  // Client-supplied fallback metadata — used when the book cache write was
  // skipped during a DB outage (see search/route.ts's "api-nocache" path),
  // so enrichment can still run without a books_cache row to read from.
  const titleParam = req.nextUrl.searchParams.get("title");
  const authorsParam = req.nextUrl.searchParams.get("authors");
  const isbn13Param = req.nextUrl.searchParams.get("isbn13");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Book cache read is best-effort — a DB outage shouldn't block
        // enrichment when the client already has the book's metadata.
        let book: { isbn13: string; title: string; authors: string[] } | null = null;
        try {
          book = await prisma.booksCache.findUnique({ where: { volumeId } });
        } catch (err) {
          console.error("Books cache unavailable, using client-supplied metadata:", err);
        }

        const title = book?.title ?? titleParam;
        const authors = book?.authors ?? (authorsParam ? authorsParam.split(",").filter(Boolean) : []);
        const isbn13 = book?.isbn13 ?? isbn13Param ?? volumeId;

        if (!title) {
          send(controller, "error", { message: "Book not found" });
          controller.close();
          return;
        }

        // Check enrichment cache — best-effort, proceed live on failure.
        let existing: { status: string; retryCount: number; reviews: unknown } | null = null;
        try {
          existing = await prisma.enrichmentCache.findUnique({ where: { isbn13 } });
        } catch (err) {
          console.error("Enrichment cache unavailable, will run live:", err);
        }

        if (existing?.status === "COMPLETED") {
          const reviews = (existing.reviews as unknown as Review[]).filter(
            (r) => r.verification_status !== "fake"
          );
          send(controller, "reviews", { reviews, source: "cache" });
          controller.close();
          return;
        }

        // Don't retry if max retries hit
        if (existing?.status === "FAILED" && existing.retryCount >= MAX_RETRIES) {
          send(controller, "reviews", { reviews: [], exhausted: true });
          controller.close();
          return;
        }

        // Ensure a books_cache row exists before touching enrichment_cache,
        // which has a foreign key on isbn13 — then mark enrichment pending.
        // Both are best-effort; the LLM call below doesn't depend on them.
        try {
          if (!book) {
            await prisma.booksCache.upsert({
              where: { volumeId },
              update: {},
              create: { isbn13, volumeId, title, authors, sourcePayload: {} },
            });
          }
          await prisma.enrichmentCache.upsert({
            where: { isbn13 },
            update: { status: "PENDING" },
            create: { isbn13, reviews: [], status: "PENDING", retryCount: 0 },
          });
        } catch (err) {
          console.error("Failed to mark enrichment pending, continuing live:", err);
        }

        send(controller, "status", { status: "pending" });

        // Call OpenAI Responses API with web search
        let reviews: Review[] = [];
        try {
          const response = await openai.responses.create({
            model: "gpt-4o",
            tools: [{ type: "web_search_preview" }],
            input: `Find real, sourced reviews or notable quotes about the book "${title}" by ${authors.join(", ")}.

Return a JSON array of up to 10 review objects. Each object must have:
- quote_text: the exact quote or review excerpt (string)
- attributed_to: the reviewer's name or publication name (string)
- source_name: publication or platform name (string)
- source_url: the real URL where this review appears (string, must be a real resolvable URL)
- source_date: approximate date of review (string, e.g. "2021" or "March 2021")
- confidence: your confidence this is a real, verifiable quote (number 0-1)

Rules:
- Only include quotes from real publications or named people that actually exist on the internet
- Do NOT fabricate quotes or sources
- If you cannot find real sourced reviews, return an empty array []
- Use web search to find actual reviews, do not rely on training data alone

Respond with ONLY the JSON array, no other text.`,
          });

          const text = response.output_text?.trim() ?? "";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            reviews = parsed
              .filter(
                (r: Partial<Review>) =>
                  r.quote_text && r.attributed_to && r.source_name
              )
              .map((r: Partial<Review>) => ({
                ...r,
                verification_status: "unverified",
              }));
          }

          // Persisting is best-effort — a DB hiccup here shouldn't discard
          // results the LLM already returned.
          try {
            await prisma.enrichmentCache.update({
              where: { isbn13 },
              data: { reviews: reviews as object[], status: "COMPLETED", generatedAt: new Date() },
            });
          } catch (err) {
            console.error("Failed to persist enrichment cache:", err);
          }

          const filtered = reviews.filter((r) => r.verification_status !== "fake");
          send(controller, "reviews", { reviews: filtered, source: "llm" });
        } catch (err) {
          console.error("OpenAI enrichment call failed:", err);
          // Record failure and increment retry count — best-effort.
          try {
            const current = await prisma.enrichmentCache.findUnique({ where: { isbn13 } });
            await prisma.enrichmentCache.update({
              where: { isbn13 },
              data: {
                status: "FAILED",
                failedAt: new Date(),
                retryCount: (current?.retryCount ?? 0) + 1,
              },
            });
          } catch (cacheErr) {
            console.error("Failed to record enrichment failure:", cacheErr);
          }
          send(controller, "reviews", { reviews: [], error: true });
        }
      } catch {
        send(controller, "error", { message: "Unexpected error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

interface Review {
  quote_text: string;
  attributed_to: string;
  source_name: string;
  source_url?: string;
  source_date?: string;
  confidence?: number;
  verification_status: "unverified" | "verified" | "fake";
}
