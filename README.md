# Bhante Sangharakshita Vector Search

A semantic search system for Buddhist texts with proper page references and citations.

## Features

- 🔍 **Semantic Search**: Find relevant passages using natural language queries
- 📚 **Page References**: Preserve original page numbers from EPUB files
- 🏷️ **Work Citations**: Automatically identify which work each passage comes from
- 🚀 **REST API**: FastAPI server for programmatic access
- 🌐 **Web Interface**: Clean, modern search interface
- 💾 **Vector Storage**: Persistent ChromaDB for efficient similarity search

## Quick Start

### 1. Setup Environment

```bash
# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=your_key_here" > .env

# Install dependencies
pip install -r requirements-api.txt
```

### 2. Ingest EPUB File

The easiest way to get started:

```bash
./quickstart.sh ./data/A_Survey_of_Buddhism_The_Buddhas_Noble_Eightfold_Path.epub
```

This will:
1. Process the EPUB and extract text chunks with page references
2. Create embeddings and populate ChromaDB
3. Optionally start the API server

**Or run the ingestion manually:**

```bash
python ingest_epub.py --epub-path ./data/your_file.epub
```

### 3. Start the API Server

```bash
./start_api.sh
```

Visit http://localhost:8000/docs for the API documentation.

### 4. Use the Search Interface

Open `src/client/index.html` in your browser.

## Documentation

- **Full Setup Guide**: See sections below
- **API Documentation**: See `README_API.md`
- **Jupyter Notebook**: See `bhante-prototyping.ipynb` for experiments

---

## Development Notes

- Currently all work is in _bhante-prototyping.ipynb_
- FastAPI server is in src/server/api.py
- Frontend (HTML/JS) is in src/client/index.html