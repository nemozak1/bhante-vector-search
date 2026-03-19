# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Semantic search system for Bhante Sangharakshita's Buddhist texts and seminar transcripts. Processes EPUB files and seminar transcripts (from freebuddhistaudio.com) into vectorized chunks stored in ChromaDB, served via a FastAPI REST API with a SvelteKit frontend.

## Commands

```bash
# Install dependencies
poetry install
# or: pip install -r requirements-api.txt

# Ingest an EPUB into ChromaDB
python ingest_epub.py --epub-path ./data/your_file.epub

# Scrape seminar transcripts from freebuddhistaudio.com
python scrape_seminars.py                          # full discovery + download
python scrape_seminars.py --retry-failed           # retry failures only
python scrape_seminars.py --codes SEM050,SEM052P1  # specific codes
python scrape_seminars.py --discover-only          # just build catalog

# Ingest seminar transcripts into ChromaDB
python ingest_seminars.py                         # ingest all downloaded
python ingest_seminars.py --codes SEM050,SEM051   # specific ones
python ingest_seminars.py --reprocess             # delete + re-add all

# Quick start (ingest + optionally start API)
./quickstart.sh ./data/your_file.epub

# Start API server
./start_api.sh
# or: python src/server/api.py
# or with hot reload: uvicorn src.server.api:app --reload --host 0.0.0.0 --port 8000

# Frontend (SvelteKit)
cd src/client && npm install && npm run dev    # dev server (proxies API to :8000)
cd src/client && npm run build                 # build static files to src/client/build/

# Run system tests (checks vector DB connectivity and API deps)
python test_system.py
```

## Architecture

**Book pipeline**: EPUB → `src/epub_processor.py` (extract chunks with page refs) → `ingest_epub.py` (embed via OpenAI + store in ChromaDB) → `src/server/api.py` → SvelteKit frontend

**Seminar pipeline**: FBA catalog API → `src/seminar_scraper.py` (discover + download) → `src/seminar_processor.py` (parse speaker turns, strip boilerplate, chunk) → `ingest_seminars.py` (embed + store) → `src/server/api.py` → SvelteKit frontend

Key components:
- `src/epub_processor.py` — `EPUBProcessor` class parses EPUB HTML, extracts page numbers from `<a id="page_XXX">` anchors, splits text into chunks. `process_epub_to_langchain()` converts chunks to LangChain `Document` objects with page/chapter/work metadata.
- `ingest_epub.py` — CLI script that orchestrates EPUB ingestion. Contains `WORK_INDEXES` dict mapping work titles to page ranges for multi-work volumes.
- `src/seminar_scraper.py` — `SeminarScraper` class discovers seminars via FBA catalog API, downloads transcript HTML, extracts `document.__FBA__.text` JSON. Saves to `data/seminars/raw/`.
- `scrape_seminars.py` — CLI entry point for scraping.
- `src/seminar_processor.py` — `SeminarProcessor` class parses transcript HTML into speaker-turn chunks, strips boilerplate intro/footer, handles speaker normalization. `process_seminar_to_langchain()` converts to LangChain Documents.
- `ingest_seminars.py` — CLI script that orchestrates seminar ingestion into ChromaDB.
- `src/server/api.py` — FastAPI app with endpoints for books (`/api/search`), seminars (`/api/seminars/search`), unified (`/api/search/all`), plus `/api/works`, `/api/seminars`, `/health`.
- `src/client/` — SvelteKit app with three tabs: All, Books, Seminars. Built to `src/client/build/` and served by FastAPI as static files.
- `src/client/index.html` — Legacy vanilla HTML/JS search UI (kept as fallback).

## API Endpoints

- `POST/GET /api/search` — search book (EPUB) collection
- `POST/GET /api/seminars/search` — search seminar collection
- `POST/GET /api/search/all` — unified search across both collections
- `GET /api/works` — list book works
- `GET /api/seminars` — list seminars in collection
- `GET /health` — health check

## Environment

- Requires `OPENAI_API_KEY` in `.env` file (loaded via python-dotenv)
- Python 3.10+, managed with Poetry
- ChromaDB data persists in `./chroma/` directory
- Book collection: `bhante_epub_search`
- Seminar collection: `bhante_seminar_search`
- Default embedding model: `text-embedding-3-large`
- Seminar data stored in `data/seminars/` (gitignored)
- `bhante-prototyping.ipynb` — Jupyter notebook used for experimentation
