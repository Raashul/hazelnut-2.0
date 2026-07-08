This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Render

This repo includes a `render.yaml` Blueprint. In the Render dashboard, choose **New > Blueprint**, point it at this repo, and Render will pick up the web service definition (build: `npm ci && npm run build`, start: `npm run start`).

Before the first deploy, set these environment variables on the service (Render won't read them from `.env` — they're marked `sync: false` in the blueprint so you enter them in the dashboard):

- `DATABASE_URL` — Supabase direct connection string (session mode, port 5432)
- `OPENAI_API_KEY`
- `JWT_SECRET` — generate with `openssl rand -base64 32`

Notes:

- `npm install` runs `prisma generate` automatically via the `postinstall` script, so the Prisma Client is built fresh on every deploy.
- The app uses a single `pg` connection pool per instance against Supabase's direct (non-pooled) connection. This is fine at one instance; if you ever scale to multiple instances, switch `DATABASE_URL` to Supabase's pooled (pgbouncer, port 6543) connection string first.
- `next start` reads `PORT` from the environment automatically, which Render sets for you.
