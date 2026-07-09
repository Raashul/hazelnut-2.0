export interface BookResult {
  isbn13: string | null;
  volumeId: string;   // OpenLibrary work key, e.g. "/works/OL12345W"
  title: string;
  authors: string[];
  coverUrl: string | null;
  rating: number | null;
  publishedYear: number | null;
  pageCount: number | null;
  description: string | null;
}

export function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

// OpenLibrary search result doc shape (fields we request)
export interface OLSearchDoc {
  key: string;                      // "/works/OL12345W"
  title?: string;
  author_name?: string[];
  isbn?: string[];                  // mix of ISBN-10 and ISBN-13
  cover_i?: number;                 // cover image ID
  first_publish_year?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  edition_count?: number;
}

export interface OLSearchResponse {
  numFound: number;
  docs: OLSearchDoc[];
}

function extractIsbn13(isbns: string[] | undefined): string | null {
  if (!isbns) return null;
  return isbns.find((id) => id.length === 13 && (id.startsWith("978") || id.startsWith("979"))) ?? null;
}

function coverUrl(coverId: number | undefined, isbn13: string | null): string | null {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  // OL search doesn't always return cover_i even when an edition has a cover.
  // Fall back to the ISBN-keyed endpoint; `default=false` makes it 404 (instead
  // of a 1x1 placeholder gif) when no cover exists, so the UI's onError handles it.
  if (isbn13) return `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg?default=false`;
  return null;
}

export function olDocToBook(doc: OLSearchDoc): BookResult {
  const isbn13 = extractIsbn13(doc.isbn);
  return {
    isbn13,
    volumeId: doc.key,
    title: doc.title ?? "Unknown title",
    authors: doc.author_name ?? [],
    coverUrl: coverUrl(doc.cover_i, isbn13),
    rating: doc.ratings_average ? Math.round(doc.ratings_average * 10) / 10 : null,
    publishedYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    description: null, // OL search doesn't return description; omit for now
  };
}

// Fields to request from OL search to keep response lean
export const OL_SEARCH_FIELDS =
  "key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median,ratings_average,edition_count";

// User-Agent required to qualify for 3 req/sec tier (vs 1 req/sec)
export const OL_USER_AGENT = "hazelnut-app/1.0 (rashul1996@gmail.com)";
