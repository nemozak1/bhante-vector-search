# Bhante Sangharakshita Vector Search

Semantic search across Sangharakshita's published books and seminar transcripts. Processes EPUBs and transcripts from [Free Buddhist Audio](https://www.freebuddhistaudio.com) into vectorized chunks stored in ChromaDB, served via a FastAPI REST API with a SvelteKit frontend.

## Features

- **Semantic search** across books and 337 seminar transcripts using OpenAI embeddings
- **Page references** preserved from EPUB sources
- **Speaker attribution** in seminar transcripts (Sangharakshita + Q&A participants)
- **Tabbed UI** — search books, seminars, or both at once
- **REST API** with OpenAPI docs

## Quick Start

### 1. Setup

```bash
# Install Python dependencies
poetry install

# Install frontend dependencies
cd src/client && npm install && cd ../..

# Create .env with your OpenAI API key
echo "OPENAI_API_KEY=your_key_here" > .env
```

### 2. Ingest Data

**Books (EPUB):**
```bash
python ingest_epub.py --epub-path ./data/your_file.epub
```

**Seminar transcripts** (three separate steps):
```bash
# Step 1: Discover and download transcripts from freebuddhistaudio.com
python scrape_seminars.py                    # ~6 min for all 337

# Step 2: Process and ingest into ChromaDB (costs OpenAI API credits)
python ingest_seminars.py                    # ingest all downloaded transcripts
```

### 3. Run

```bash
./start_dev.sh
```

This starts both the FastAPI backend (port 8000) and SvelteKit frontend (port 5173), opens the browser, and stops both on Ctrl+C.

**Or start them separately:**
```bash
# Terminal 1: API
uvicorn src.server.api:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd src/client && npm run dev
```

Visit http://localhost:5173 for the search UI, or http://localhost:8000/docs for the API.

## Seminar Pipeline

The seminar workflow has three stages, each with its own script:

| Step | Script | What it does | Cost |
|------|--------|-------------|------|
| Scrape | `scrape_seminars.py` | Discovers seminars via FBA catalog API, downloads transcript HTML/JSON to `data/seminars/raw/` | Free (network only) |
| Process + Ingest | `ingest_seminars.py` | Parses transcripts into speaker-turn chunks, embeds via OpenAI, stores in ChromaDB | OpenAI API credits |

Scraping and ingestion are separate because scraping is free and network-bound, while ingestion costs API credits. You can scrape everything first, then ingest selectively.

```bash
# Scraping options
python scrape_seminars.py --discover-only          # just build catalog, don't download
python scrape_seminars.py --codes SEM050,SEM051    # download specific seminars
python scrape_seminars.py --retry-failed           # retry failed downloads

# Ingestion options
python ingest_seminars.py --codes SEM050,SEM051    # ingest specific seminars
python ingest_seminars.py --reprocess              # delete and re-ingest all
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/search` | Search book (EPUB) collection |
| GET/POST | `/api/seminars/search` | Search seminar collection |
| GET/POST | `/api/search/all` | Unified search across both collections |
| GET | `/api/works` | List book works |
| GET | `/api/seminars` | List ingested seminars |
| GET | `/health` | Health check |

See `README_API.md` for detailed API documentation with examples.

## Architecture

```
EPUB files ──► epub_processor.py ──► ingest_epub.py ──┐
                                                       ├──► ChromaDB ──► api.py ──► SvelteKit UI
FBA website ──► seminar_scraper.py ──► seminar_processor.py ──► ingest_seminars.py ──┘
```

**Key files:**
- `src/epub_processor.py` — EPUB parsing, page number extraction, chunking
- `src/seminar_scraper.py` — FBA catalog discovery, transcript download
- `src/seminar_processor.py` — Speaker-turn parsing, boilerplate removal, chunking
- `src/server/api.py` — FastAPI with book, seminar, and unified search endpoints
- `src/client/` — SvelteKit frontend (tabs: All / Books / Seminars)

## Environment

- Python 3.10+, managed with Poetry
- `OPENAI_API_KEY` in `.env` (required)
- ChromaDB persists in `./chroma/`
- Book collection: `bhante_epub_search`
- Seminar collection: `bhante_seminar_search`
- Embedding model: `text-embedding-3-large`
