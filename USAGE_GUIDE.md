# Bhante Vector Search - Usage Guide

Complete guide for ingesting EPUB files and using the search system.

## Table of Contents

1. [Installation](#installation)
2. [Ingesting EPUB Files](#ingesting-epub-files)
3. [Starting the API](#starting-the-api)
4. [Using the Web Interface](#using-the-web-interface)
5. [Using the API](#using-the-api)
6. [Using in Python](#using-in-python)
7. [Advanced Configuration](#advanced-configuration)

---

## Installation

### Prerequisites

- Python 3.8+
- OpenAI API key

### Setup Steps

1. **Clone and navigate to the project:**
   ```bash
   cd /path/to/bhante-vector-search
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements-api.txt
   ```

3. **Configure environment:**
   ```bash
   # Create .env file
   echo "OPENAI_API_KEY=sk-your-key-here" > .env
   ```

4. **Verify installation:**
   ```bash
   python test_system.py
   ```

---

## Ingesting EPUB Files

### Quick Start (Recommended)

Use the quickstart script for automatic setup:

```bash
./quickstart.sh ./data/A_Survey_of_Buddhism_The_Buddhas_Noble_Eightfold_Path.epub
```

This will:
- Process the EPUB file
- Extract text chunks with page references
- Generate embeddings using OpenAI
- Store in ChromaDB
- Optionally start the API

### Manual Ingestion

For more control, use the ingestion script directly:

```bash
python ingest_epub.py --epub-path ./data/your_book.epub
```

### Ingestion Options

```bash
# Custom collection name
python ingest_epub.py \
  --epub-path ./data/your_book.epub \
  --collection-name my_collection

# Smaller chunks (more granular search)
python ingest_epub.py \
  --epub-path ./data/your_book.epub \
  --chunk-size 300

# Different embedding model
python ingest_epub.py \
  --epub-path ./data/your_book.epub \
  --embedding-model text-embedding-3-small

# Custom storage location
python ingest_epub.py \
  --epub-path ./data/your_book.epub \
  --persist-dir ./my_vector_db

# See all options
python ingest_epub.py --help
```

### Understanding Chunk Size

The `--chunk-size` parameter controls how text is divided:

- **Small chunks (200-300)**: 
  - ✅ More precise matching
  - ✅ Better for specific facts
  - ❌ May fragment context
  
- **Medium chunks (500-800)**:
  - ✅ Good balance (default: 500)
  - ✅ Preserves context
  - ✅ Works for most queries
  
- **Large chunks (1000+)**:
  - ✅ Maximum context
  - ❌ Less precise matching
  - ❌ May include irrelevant text

### Handling Multiple Volumes

To ingest different volumes, use different collection names:

```bash
# Volume 1
python ingest_epub.py \
  --epub-path ./data/complete_works_vol1.epub \
  --collection-name bhante_vol1

# Volume 2
python ingest_epub.py \
  --epub-path ./data/complete_works_vol2.epub \
  --collection-name bhante_vol2 \
  --work-index complete_works_vol2
```

---

## Starting the API

### Quick Start

```bash
./start_api.sh
```

The API will be available at: **http://localhost:8000**

### Manual Start

```bash
python src/server/api.py
```

Or with uvicorn for development:

```bash
uvicorn src.server.api:app --reload --host 0.0.0.0 --port 8000
```

### Verify API is Running

```bash
# Health check
curl http://localhost:8000/health

# Test search
curl "http://localhost:8000/api/search?query=What%20is%20meditation&k=3"
```

### API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Using the Web Interface

### Option 1: Direct File Access

Simply open `src/client/index.html` in your browser.

### Option 2: Local Web Server

```bash
cd src/client
python -m http.server 3000
```

Then visit: **http://localhost:3000**

### Using the Interface

1. **Enter your query** in the search box
2. **Adjust number of results** (1-20)
3. **Click Search** or press Enter
4. **View results** with citations:
   - Content text
   - Work title
   - Page number
   - Chapter (if available)
   - Relevance score

---

## Using the API

### REST Endpoints

#### POST /api/search

Full-featured search endpoint.

**Request:**
```json
POST http://localhost:8000/api/search
Content-Type: application/json

{
  "query": "What is the Noble Eightfold Path?",
  "k": 5,
  "filter": {
    "work": "A Survey of Buddhism"
  }
}
```

**Response:**
```json
{
  "query": "What is the Noble Eightfold Path?",
  "results": [
    {
      "content": "The Noble Eightfold Path is...",
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

#### GET /api/search

Simpler search via URL parameters.

```bash
curl "http://localhost:8000/api/search?query=What+is+meditation&k=5"
```

#### GET /api/works

List all available works.

```bash
curl http://localhost:8000/api/works
```

### cURL Examples

```bash
# Basic search
curl "http://localhost:8000/api/search?query=What%20is%20a%20kalpa&k=5"

# POST with filter
curl -X POST "http://localhost:8000/api/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "meditation practices",
    "k": 10,
    "filter": {"work": "The Buddha'\''s Noble Eightfold Path"}
  }'

# Pretty print JSON
curl "http://localhost:8000/api/search?query=dharma&k=3" | jq .
```

---

## Using in Python

### Direct ChromaDB Access

```python
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Connect to vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
db = Chroma(
    collection_name="bhante_epub_search",
    embedding_function=embeddings,
    persist_directory="./chroma"
)

# Search
results = db.similarity_search("What is a kalpa?", k=5)

# Display results
for i, result in enumerate(results, 1):
    print(f"\n--- Result {i} ---")
    print(result.page_content)
    print(f"\nFrom: {result.metadata.get('work', 'Unknown')}")
    print(f"Page: {result.metadata.get('page_label', 'Unknown')}")
    if 'chapter' in result.metadata:
        print(f"Chapter: {result.metadata['chapter']}")
```

### Using the API with Requests

```python
import requests

def search_texts(query, k=5, filter=None):
    """Search Buddhist texts via API."""
    response = requests.post(
        'http://localhost:8000/api/search',
        json={'query': query, 'k': k, 'filter': filter}
    )
    response.raise_for_status()
    return response.json()

# Example usage
results = search_texts("What is the nature of suffering?", k=3)

for i, result in enumerate(results['results'], 1):
    print(f"\n{i}. {result['content'][:200]}...")
    print(f"   Source: {result['work']}, p. {result['page_label']}")
```

### Batch Processing

```python
# Process multiple queries
queries = [
    "What is meditation?",
    "What is the Noble Eightfold Path?",
    "What are the Four Noble Truths?"
]

for query in queries:
    print(f"\nQuery: {query}")
    results = db.similarity_search(query, k=3)
    for result in results:
        print(f"  - {result.page_content[:100]}...")
```

---

## Advanced Configuration

### Custom Work Indexes

Edit `ingest_epub.py` to add your own book structure:

```python
WORK_INDEXES = {
    "my_custom_volume": {
        "First Work Title": (start_page, end_page),
        "Second Work Title": (start_page, end_page),
    }
}
```

Then use it:

```bash
python ingest_epub.py \
  --epub-path ./data/my_book.epub \
  --work-index my_custom_volume
```

### Environment Variables

Create a `.env` file with:

```bash
# Required
OPENAI_API_KEY=sk-your-key-here

# Optional
OPENAI_API_BASE=https://api.openai.com/v1  # Custom endpoint
OPENAI_ORGANIZATION=org-xxx                 # Your org ID
```

### Using Different Embedding Models

**In ingestion:**
```bash
python ingest_epub.py \
  --epub-path ./data/your_book.epub \
  --embedding-model text-embedding-3-small
```

**In API** (edit `src/server/api.py`):
```python
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
```

**In Python**:
```python
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
db = Chroma(..., embedding_function=embeddings)
```

### Multiple Collections

Search across different collections:

```python
# Connect to different collections
vol1 = Chroma(collection_name="bhante_vol1", ...)
vol2 = Chroma(collection_name="bhante_vol2", ...)

# Search both
results_vol1 = vol1.similarity_search(query, k=5)
results_vol2 = vol2.similarity_search(query, k=5)

# Combine results
all_results = results_vol1 + results_vol2
```

### Metadata Filtering

```python
# Search only specific work
results = db.similarity_search(
    "meditation",
    k=10,
    filter={"work": "A Survey of Buddhism"}
)

# Search specific page range
results = db.similarity_search(
    "dharma",
    k=10,
    filter={"page": {"$gte": 100, "$lte": 200}}
)
```

---

## Troubleshooting

### No Results Found

1. Check collection has data:
   ```bash
   ls -la ./chroma/
   python test_system.py
   ```

2. Try a broader query
3. Increase `k` (number of results)
4. Check the collection name matches

### Poor Search Quality

1. Try different chunk sizes during ingestion
2. Use more specific queries
3. Increase `k` to see more results
4. Consider using filters to narrow scope

### API Not Starting

1. Check port 8000 is available:
   ```bash
   lsof -i :8000
   ```

2. Verify ChromaDB exists:
   ```bash
   ls -la ./chroma/
   ```

3. Check API key in `.env`

### Slow Ingestion

1. Reduce batch size: `--batch-size 50`
2. Use smaller embedding model: `--embedding-model text-embedding-3-small`
3. Increase chunk size: `--chunk-size 1000`

---

## Tips & Best Practices

### Query Writing

- ✅ Use natural language: "How do I practice meditation?"
- ✅ Be specific: "What are the stages of the spiritual path?"
- ❌ Avoid keywords only: "meditation stages path"

### Result Interpretation

- Check the relevance score (lower is better)
- Read surrounding context via page numbers
- Compare multiple results for comprehensive understanding

### Performance

- First query may be slow (embedding generation)
- Subsequent queries are fast (cached embeddings)
- Larger `k` values take longer

### Data Management

- Keep your `.env` file secure (never commit it)
- Backup `./chroma/` directory periodically
- Re-ingest if you change embedding models

---

## Next Steps

- 📖 Read `README_API.md` for detailed API documentation
- 🧪 Explore `bhante-prototyping.ipynb` for experiments
- 🔧 Customize `src/epub_processor.py` for your needs
- 🌐 Enhance `src/client/index.html` for better UI

## Support

For issues or questions:
1. Check this guide first
2. Review error messages carefully
3. Run `python test_system.py` to diagnose
4. Check the project README.md
