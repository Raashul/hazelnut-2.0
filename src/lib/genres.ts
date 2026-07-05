// Fixed genre list for the Explore page. Each genre maps 1:1 to an
// OpenLibrary subject slug (see https://openlibrary.org/subjects/{olSubject}),
// used by both the population script and the explore UI.
export interface Genre {
  slug: string;
  label: string;
  olSubject: string;
}

export const GENRES: Genre[] = [
  { slug: "fantasy", label: "Fantasy", olSubject: "fantasy" },
  { slug: "business", label: "Business", olSubject: "business" },
  {
    slug: "science-fiction",
    label: "Science Fiction",
    olSubject: "science_fiction",
  },
  { slug: "mystery", label: "Mystery", olSubject: "mystery" },
  { slug: "thriller", label: "Thriller", olSubject: "thriller" },
  { slug: "romance", label: "Romance", olSubject: "romance" },
  { slug: "horror", label: "Horror", olSubject: "horror" },
  {
    slug: "historical-fiction",
    label: "Historical Fiction",
    olSubject: "historical_fiction",
  },
  { slug: "biography", label: "Biography & Memoir", olSubject: "biography" },
  {
    slug: "young-adult",
    label: "Young Adult",
    olSubject: "young_adult_fiction",
  },
  { slug: "poetry", label: "Poetry", olSubject: "poetry" },
  { slug: "self-help", label: "Self-Help", olSubject: "self-help" },
  { slug: "history", label: "History", olSubject: "history" },
];

export function getGenreBySlug(slug: string): Genre | undefined {
  return GENRES.find((g) => g.slug === slug);
}
