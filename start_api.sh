#!/bin/bash

# Start script for Bhante Vector Search API

set -e

echo "🚀 Starting Bhante Vector Search API..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Please create a .env file with your OPENAI_API_KEY"
    exit 1
fi

# Check if chroma directory exists
if [ ! -d "./chroma" ]; then
    echo "⚠️  Warning: ./chroma directory not found!"
    echo "Please run the notebook cells to populate ChromaDB first"
    exit 1
fi

# Install dependencies if needed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements-api.txt
fi

# Start the server
echo "✅ Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""

python src/server/api.py
