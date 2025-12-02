# Bhante Sangharakshita Vector Search API

A FastAPI-based semantic search service for Buddhist texts with proper page references and metadata.

## Features

- 🔍 Semantic search using OpenAI embeddings
- 📚 Proper page references and work citations
- 🚀 Fast and efficient vector similarity search
- 🌐 RESTful API with OpenAPI documentation
- 💾 ChromaDB for persistent vector storage

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements-api.txt
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Prepare the Vector Database

First, run the notebook cells to process your EPUB files and populate ChromaDB:

```python
# In bhante-prototyping.ipynb
# Run the cells that:
# 1. Process EPUB with process_epub_to_langchain()
# 2. Add documents to ChromaDB
```

This will create a `./chroma` directory with your vector embeddings.

## Running the API

### Start the Server

```bash
# From project root
python src/server/api.py

# Or using uvicorn directly
uvicorn src.server.api:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### POST /api/search
Perform semantic search with full options.

**Request Body:**
```json
{
  "query": "What is a kalpa?",
  "k": 5,
  "filter": {
    "work": "A Survey of Buddhism"
  }
}
```

**Response:**
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

### GET /api/search
Simple search via query parameters.

```bash
curl "http://localhost:8000/api/search?query=What%20is%20a%20kalpa&k=5"
```

### GET /api/works
List all available works.

```bash
curl http://localhost:8000/api/works
```

### GET /health
Health check endpoint.

```bash
curl http://localhost:8000/health
```

## Web Client

A simple HTML client is provided at `src/client/index.html`.

To use it:

1. Start the API server (see above)
2. Open `src/client/index.html` in your browser
3. Enter your search query and click "Search"

Or serve it with a simple HTTP server:

```bash
cd src/client
python -m http.server 3000
```

Then visit: `http://localhost:3000`

## Usage Examples

### Python Client

```python
import requests

# Search for content
response = requests.post('http://localhost:8000/api/search', json={
    'query': 'What is the Noble Eightfold Path?',
    'k': 3
})

results = response.json()
for result in results['results']:
    print(f"{result['content'][:100]}...")
    print(f"From: {result['work']}, Page {result['page_label']}\n")
```

### cURL

```bash
# Basic search
curl -X POST "http://localhost:8000/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is meditation?", "k": 5}'

# Search with filter
curl -X POST "http://localhost:8000/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is meditation?", "k": 5, "filter": {"work": "A Survey of Buddhism"}}'
```

### JavaScript/Fetch

```javascript
async function search(query) {
  const response = await fetch('http://localhost:8000/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, k: 5 })
  });
  
  const data = await response.json();
  return data.results;
}

const results = await search('What is a kalpa?');
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)

### Server Configuration

Edit `src/server/api.py` to modify:
- `collection_name`: ChromaDB collection name
- `persist_directory`: Path to ChromaDB storage
- Default embedding model
- CORS settings for production

## Architecture

```
┌─────────────┐
│   Client    │ (Browser/CLI)
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│  FastAPI    │ (src/server/api.py)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  LangChain  │ (Embeddings + Search)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ChromaDB   │ (Vector Storage)
└─────────────┘
```

## Troubleshooting

### "Vector store not initialized"
Make sure you've run the notebook cells to populate ChromaDB first.

### "Cannot connect to API server"
Check that the FastAPI server is running on port 8000.

### CORS errors in browser
Update the CORS settings in `src/server/api.py` for your domain.

### Empty results
Verify that documents were properly added to ChromaDB with page metadata.

## Development

### Run with hot reload
```bash
uvicorn src.server.api:app --reload
```

### Run tests
```bash
pytest tests/
```

## License

MIT
