# Bhante Sangharakshita Vector Search API

FastAPI semantic search service for Buddhist texts and seminar transcripts.

## Setup

```bash
poetry install
echo "OPENAI_API_KEY=your_key" > .env
uvicorn src.server.api:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

### POST /api/search — Search books

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is a kalpa?", "k": 5}'
```

```json
{
  "query": "What is a kalpa?",
  "results": [
    {
      "content": "A kalpa is an aeon...",
      "page": 191,
      "page_label": "191",
      "chapter": "The Buddha and Buddhism",
      "work": "A Survey of Buddhism",
      "score": 0.85
    }
  ],
  "total_results": 5
}
```

**GET variant:** `GET /api/search?query=What+is+a+kalpa&k=5`

### POST /api/seminars/search — Search seminars

```bash
curl -X POST http://localhost:8000/api/seminars/search \
  -H "Content-Type: application/json" \
  -d '{"query": "meditation practice", "k": 5}'
```

```json
{
  "query": "meditation practice",
  "results": [
    {
      "content": "Well there are several...",
      "seminar_title": "Advice to the Three Fortunate Women",
      "seminar_code": "SEM048",
      "speaker": "Sangharakshita",
      "section_heading": null,
      "date": "1980",
      "location": "Padmaloka",
      "score": 0.82
    }
  ],
  "total_results": 5
}
```

**GET variant:** `GET /api/seminars/search?query=meditation+practice&k=5`

### POST /api/search/all — Unified search

Searches both book and seminar collections, merges results by relevance score.

```bash
curl -X POST http://localhost:8000/api/search/all \
  -H "Content-Type: application/json" \
  -d '{"query": "the nature of mind", "k": 5}'
```

Each result includes a `content_type` field (`"epub"` or `"seminar"`) plus the relevant metadata fields for that type.

**GET variant:** `GET /api/search/all?query=the+nature+of+mind&k=5`

### GET /api/works — List books

```bash
curl http://localhost:8000/api/works
```

### GET /api/seminars — List seminars

```bash
curl http://localhost:8000/api/seminars
```

Returns all distinct seminars in the collection with code, title, date, and location.

### GET /health — Health check

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "epub_store_connected": true,
  "seminar_store_connected": true
}
```

## Filtering

All search endpoints accept an optional `filter` field for metadata filtering:

```json
{
  "query": "meditation",
  "k": 5,
  "filter": {"work": "A Survey of Buddhism"}
}
```

```json
{
  "query": "meditation",
  "k": 5,
  "filter": {"speaker": "Sangharakshita"}
}
```

## Python Client Example

```python
import requests

# Unified search
resp = requests.get('http://localhost:8000/api/search/all', params={
    'query': 'What is the Noble Eightfold Path?',
    'k': 3
})

for result in resp.json()['results']:
    print(f"[{result['content_type']}] {result['content'][:100]}...")
```

## Configuration

Edit `src/server/api.py` or set via environment:
- Collection names: `bhante_epub_search`, `bhante_seminar_search`
- ChromaDB directory: `./chroma`
- Embedding model: `text-embedding-3-large`
- CORS: configured for all origins (restrict for production)
