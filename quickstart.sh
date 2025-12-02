#!/bin/bash

# Quick start script for ingesting EPUB and starting the API

set -e

echo "🚀 Bhante Vector Search - Quick Start"
echo "======================================"
echo ""

# Check if EPUB file is provided
if [ -z "$1" ]; then
    echo "Usage: ./quickstart.sh <path-to-epub-file>"
    echo ""
    echo "Example:"
    echo "  ./quickstart.sh ./data/A_Survey_of_Buddhism_The_Buddhas_Noble_Eightfold_Path.epub"
    exit 1
fi

EPUB_FILE="$1"

# Check if file exists
if [ ! -f "$EPUB_FILE" ]; then
    echo "❌ Error: File not found: $EPUB_FILE"
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Please create a .env file with your OPENAI_API_KEY:"
    echo "  OPENAI_API_KEY=your_key_here"
    exit 1
fi

# Step 1: Ingest EPUB
echo "📚 Step 1: Ingesting EPUB file..."
echo ""
python ingest_epub.py --epub-path "$EPUB_FILE"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Error during ingestion. Please check the error messages above."
    exit 1
fi

echo ""
echo "✅ Ingestion complete!"
echo ""

# Step 2: Ask if user wants to start the API
read -p "🚀 Do you want to start the API server now? [Y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    echo "Starting API server..."
    echo "Press Ctrl+C to stop the server"
    echo ""
    python src/server/api.py
else
    echo ""
    echo "📝 To start the API later, run:"
    echo "  ./start_api.sh"
    echo ""
    echo "📚 To test search, run:"
    echo "  python -c \"from langchain_chroma import Chroma; from langchain_openai import OpenAIEmbeddings; db = Chroma(collection_name='bhante_epub_search', embedding_function=OpenAIEmbeddings(model='text-embedding-3-large'), persist_directory='./chroma'); print(db.similarity_search('What is a kalpa?', k=3))\""
fi
