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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const book = await prisma.booksCache.findUnique({ where: { volumeId } });
        if (!book) {
          send(controller, "error", { message: "Book not found" });
          controller.close();
          return;
        }

        const isbn13 = book.isbn13;

        // Check enrichment cache
        const existing = await prisma.enrichmentCache.findUnique({
          where: { isbn13 },
        });

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

        // Mark as pending
        await prisma.enrichmentCache.upsert({
          where: { isbn13 },
          update: { status: "PENDING" },
          create: { isbn13, reviews: [], status: "PENDING", retryCount: 0 },
        });

        send(controller, "status", { status: "pending" });

        // Call OpenAI Responses API with web search
        let reviews: Review[] = [];
        try {
          const response = await openai.responses.create({
            model: "gpt-4o",
            tools: [{ type: "web_search_preview" }],
            input: `Find real, sourced reviews or notable quotes about the book "${book.title}" by ${book.authors.join(", ")}.

Return a JSON array of up to 5 review objects. Each object must have:
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

          await prisma.enrichmentCache.update({
            where: { isbn13 },
            data: { reviews: reviews as object[], status: "COMPLETED", generatedAt: new Date() },
          });

          const filtered = reviews.filter((r) => r.verification_status !== "fake");
          send(controller, "reviews", { reviews: filtered, source: "llm" });
        } catch {
          // Record failure and increment retry count
          const current = await prisma.enrichmentCache.findUnique({ where: { isbn13 } });
          await prisma.enrichmentCache.update({
            where: { isbn13 },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              retryCount: (current?.retryCount ?? 0) + 1,
            },
          });
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
