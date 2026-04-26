# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Semantic search for Bhante Sangharakshita's books and seminar transcripts. Single SvelteKit app (Node adapter) with Postgres + pgvector. Auth is Better Auth.

Two storage stories run side by side:
- **Cleaned transcripts and review status are JSON files in git.** A remote Claude agent edits `data/seminars/cleaned/{code}.json` and `data/seminars/review_status.json` and opens GitHub PRs; humans review via PR review. The SvelteKit app reads these straight from disk.
- **Embeddings, ingestion log, and per-user state are in Postgres.** Better Auth tables, `chunks` (pgvector, 3072-dim text-embedding-3-large vectors via halfvec HNSW), `ingestion_log`, `bookmarks`, `search_history`, `saved_queries`.

The remote-agent / PR workflow is V1. V2 (post-bulk-cleanup) will add an editor-user role and move canonical content into Postgres — but the schema for that is deferred until the editor UX is scoped.

## Commands

```bash
# Bring Postgres up (one-time per machine reboot)
docker compose up -d postgres

# Dev server (auto-runs migrations on first request)
npm install
npm run dev                                # http://localhost:5173

# Apply migrations explicitly (also runs on dev startup)
npm run migrate

# Seed the dev user (dev@bhante.local / devpassword) — powers the
# "Sign in as dev@bhante.local" button on /login (visible only when import.meta.env.DEV)
npm run seed:dev

# Backfill ingest_log.json into ingestion_log (one-shot, idempotent)
python scripts/seed_from_files.py

# Seed the seminars catalog from data/seminars/cleaned/{code}.json (preferred)
# or raw/{code}.json (fallback). Re-run after the agent merges PRs that touch
# titles/dates/locations. Use `-- --code SEM001` for one seminar.
npm run seed:catalog

# Seed seminar_contents from data/seminars/raw/*C.json files (one-shot, idempotent;
# re-run after adding/changing C files). Use `-- --code SEM001` for one seminar.
npm run seed:contents

# Migrate embeddings from Chroma into pgvector (one-shot, idempotent)
python scripts/migrate_chroma_to_pgvector.py

# Build for production
npm run build
npm run start                              # serves the adapter-node build

# Type-check the SvelteKit project
npm run check

# End-to-end tests (Playwright; auto-starts dev server, signs in as the seeded
# dev user, hits real Postgres + pgvector). Run `npm run seed:dev` first.
npm run test:e2e
npm run test:e2e:ui                        # interactive runner
npm run test:e2e:headed                    # see the browser
```

### Ingestion (Python, batch tools — write directly to pgvector)

```bash
# Scrape new seminars from freebuddhistaudio.com
python scrape_seminars.py
python scrape_seminars.py --codes SEM050,SEM052P1
python scrape_seminars.py --discover-only

# Ingest an EPUB into pgvector
python ingest_epub.py --epub-path ./data/your_file.epub

# Ingest seminars into pgvector (prefers cleaned/{code}.json, falls back to raw via processor)
python ingest_seminars.py                      # all
python ingest_seminars.py --codes SEM050,151   # specific codes
python ingest_seminars.py --raw-only           # ignore cleaned/, use raw via processor
python ingest_seminars.py --reprocess          # force re-ingestion even if source SHA matches the last log row
```

`ingest_seminars.py` is **idempotent at the source-SHA level**: it computes `git hash-object data/seminars/cleaned/{code}.json` (falling back to a sha256 of the file bytes if not in git, then to the raw file if cleaned doesn't exist) and skips the seminar if the most recent `ingestion_log` row for that code already has the same `source_sha`. Use `--reprocess` to override.

When a seminar is re-ingested, the script first **deletes any existing chunks** for that `seminar_code` in the target collection, then re-embeds and inserts fresh — no orphaned chunks. The OpenAI embedding call costs apply.

**Planned bulk re-ingest:** once the remote-Claude PR review pass has cleaned all 200 seminars, run `python ingest_seminars.py --reprocess` to rebuild the entire seminar index from the cleaned versions. Until then, ingestion runs incrementally for whatever seminars have been added or changed.

## Architecture

Three layers — **remote → services → DAL** — let RBAC, validation and orchestration each live in one place. SQL is confined to the DAL; the auth gate (and any future `can()` check) lives in remote functions; services own composition and never read `locals`.

```
src/
├── routes/                              SvelteKit routes
│   ├── login/, search/, seminars/, review/   pages (CSR; auth gated client-side)
│   ├── *.remote.ts                           transport: query/command/form fns,
│   │                                          auth gate via requireUser(), valibot validation
│   │   ├── search.remote.ts                 books, seminars, all
│   │   ├── seminars.remote.ts               list, get
│   │   ├── works.remote.ts                  list
│   │   ├── review.remote.ts                 status, diff
│   │   ├── bookmarks.remote.ts              list, create, remove
│   │   ├── saved-queries.remote.ts          list, save, remove
│   │   └── search-history.remote.ts         recent
│   └── api/                                  legacy +server.ts (binary streams + Better Auth)
│       ├── auth/[...auth]                   Better Auth catch-all (handled by hooks)
│       ├── seminars/[code]/{pdf,epub,print} pdfkit + epub-gen-memory streams
│       └── health                            unauth liveness check
├── lib/
│   ├── auth.ts            Better Auth instance (pg.Pool + sveltekitCookies)
│   ├── auth-client.ts     createAuthClient for the browser
│   ├── auth.svelte.ts     thin facade preserving signIn/signUp/signOut
│   ├── types.ts           shared client+server types (canonical)
│   ├── searchState.ts     in-memory cache for search results across tab switches
│   └── server/
│       ├── env.ts                  fail-loud env reader
│       ├── auth-context.ts         requireUser() — auth gate used by remote fns
│       ├── embed.ts                OpenAI embeddings client
│       ├── db/pool.ts              singleton pg.Pool
│       ├── db/migrate.ts           startup migrations runner
│       ├── dal/                    pure SQL, one file per domain (no business logic)
│       │   ├── bookmarks.ts        listByUser, upsert, deleteByUserAndId
│       │   ├── saved-queries.ts
│       │   ├── search-history.ts
│       │   ├── chunks.ts           pgvector halfvec similarity query
│       │   ├── seminars.ts         seminars catalog (list, getByCode)
│       │   └── seminar-contents.ts
│       ├── services/               orchestration; takes userId; throws kit errors
│       │   ├── bookmarks.ts
│       │   ├── saved-queries.ts
│       │   ├── search-history.ts
│       │   ├── search.ts           embed → DAL → result shape → record history
│       │   ├── seminars.ts         DAL list + disk-load transcript + DAL contents
│       │   ├── works.ts
│       │   └── review.ts           review_status.json + diff against raw parse
│       └── seminars/               filesystem/parsing helpers (used by services)
│           ├── processor.ts        port of process_for_display (cheerio)
│           ├── load.ts             cleaned-or-raw file loader
│           ├── parse-contents.ts   parser for {code}C.json TOC pages
│           └── render.ts           shared HTML for /print and /pdf fallback
├── hooks.server.ts         Better Auth session resolution + /api/* gate
├── app.d.ts                Locals typing
├── epub_processor.py       Python ingestion library (used by ingest_epub.py)
├── seminar_processor.py    Python ingestion library (used by ingest_seminars.py)
└── seminar_scraper.py      Python scraper

migrations/                 numbered .sql files, applied in order
├── 0001_better_auth.sql    user, session, account, verification (generated)
├── 0002_ingestion.sql      ingestion_log
├── 0003_user_features.sql  bookmarks, search_history, saved_queries
├── 0004_pgvector.sql       chunks (vector(3072) + halfvec HNSW index)
├── 0005_seminar_contents.sql  seminar_contents (TOC entries scraped from raw/*C.json)
└── 0006_seminars.sql       seminars catalog + FK from seminar_contents.seminar_code

scripts/                    one-shot Python scripts
├── seed_from_files.py             ingest_log.json → Postgres
└── migrate_chroma_to_pgvector.py  Chroma → pgvector (no re-embedding)

data/seminars/              source of truth for seminar text
├── cleaned/{code}.json     PR-edited cleaned transcripts (TRACKED)
├── raw/{code}.json         immutable scrape output (gitignored)
├── review_status.json      review state (TRACKED)
└── ingest_log.json         what's been vectorised (gitignored)

chroma/                     legacy embedding store, kept on disk after the
                            pgvector migration as a backup. Search no longer
                            reads from it; only ingest_*.py write to it.
```

## Endpoints

### Remote functions (`*.remote.ts`)

All cookie-gated. Pages import directly: `import * as searchRemote from '../search.remote'`. SvelteKit handles RPC transport — no client SDK needed.

| File | Exports | Verb |
|---|---|---|
| `search.remote.ts` | `books`, `seminars`, `all` | query |
| `seminars.remote.ts` | `list`, `get` | query |
| `works.remote.ts` | `list` | query |
| `review.remote.ts` | `status`, `diff` | query |
| `search-history.remote.ts` | `recent` | query |
| `bookmarks.remote.ts` | `list` (q), `create` / `remove` (cmd) | query / command |
| `saved-queries.remote.ts` | `list` (q), `save` / `remove` (cmd) | query / command |

Each remote function calls `requireUser()` first; the same module is where future RBAC checks (`can(user, 'bookmarks:read')`) will land.

### Legacy HTTP endpoints (`+server.ts`)

Reserved for Better Auth and binary streams that don't fit the remote-fn model.

Public:
- `GET /api/health`
- `GET/POST /api/auth/*` (Better Auth — sign-up, sign-in, sign-out, get-session, etc.)

Auth required (cookie, gated in `hooks.server.ts`):
- `GET /api/seminars/[code]/{pdf,epub,print}` — binary downloads

## Environment

Required (`.env` at repo root, `.env.example` is the template):

| Var | Purpose |
|---|---|
| `OPENAI_API_KEY` | Embeddings (search + ingestion) |
| `DATABASE_URL` | Postgres (e.g. `postgresql://bhante:bhante@localhost:5433/bhante`) |
| `BETTER_AUTH_SECRET` | Min 32 chars; `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | App URL, e.g. `http://localhost:5173` |

Optional:
- `EMBEDDING_MODEL` — defaults to `text-embedding-3-large`
- `BOOK_COLLECTION` / `SEMINAR_COLLECTION` — defaults to the historical Chroma collection names; both are passed through to the `chunks.collection` column in pgvector

The Postgres dev container exposes 5432 → host **5433** (5432 was taken on the original dev machine).

## Notable migrations / one-time operations

- `npm run migrate` applies any unapplied `migrations/*.sql` files. Idempotent. Auto-runs on first request to the dev server.
- `python scripts/seed_from_files.py` — backfills `ingest_log.json` into `ingestion_log`. Run once after schema lands.
- `python scripts/migrate_chroma_to_pgvector.py` — copies all 13K chunks from `./chroma` into the `chunks` table. No re-embedding. Idempotent (skips if pgvector already has ≥ chroma's count). Run once after `0004_pgvector.sql` is applied; re-run after any new Chroma-side ingestion.
