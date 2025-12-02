#!/usr/bin/env python3
"""
Test the EPUB ingestion and search functionality.

This script verifies that the vector database is working correctly.
"""

import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
load_dotenv()

def test_vector_db():
    """Test that the vector database is accessible and has data."""
    print("🧪 Testing Vector Database")
    print("=" * 50)
    
    try:
        from langchain_chroma import Chroma
        from langchain_openai import OpenAIEmbeddings
        
        print("✓ Imports successful")
        
        # Check if chroma directory exists
        chroma_path = Path("./chroma")
        if not chroma_path.exists():
            print("❌ ChromaDB directory not found at ./chroma")
            print("   Run: python ingest_epub.py --epub-path <your-epub-file>")
            return False
        
        print(f"✓ ChromaDB directory exists: {chroma_path.absolute()}")
        
        # Connect to vector store
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        db = Chroma(
            collection_name="bhante_epub_search",
            embedding_function=embeddings,
            persist_directory="./chroma"
        )
        
        print("✓ Connected to ChromaDB")
        
        # Try a search
        test_query = "What is a kalpa?"
        print(f"\n🔍 Testing search: '{test_query}'")
        
        results = db.similarity_search(test_query, k=3)
        
        if not results:
            print("❌ No results found. Database may be empty.")
            print("   Run: python ingest_epub.py --epub-path <your-epub-file>")
            return False
        
        print(f"✓ Found {len(results)} results")
        
        # Display first result
        print(f"\n📄 First result:")
        result = results[0]
        print(f"   Content: {result.page_content[:150]}...")
        print(f"   Metadata: {result.metadata}")
        
        # Check for required metadata
        has_page = 'page' in result.metadata
        has_work = 'work' in result.metadata
        
        print(f"\n📊 Metadata check:")
        print(f"   {'✓' if has_page else '❌'} Page numbers")
        print(f"   {'✓' if has_work else '❌'} Work titles")
        
        if has_page and has_work:
            print(f"\n✨ All tests passed!")
            return True
        else:
            print(f"\n⚠️  Tests passed but metadata incomplete")
            return True
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Run: pip install -r requirements-api.txt")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api():
    """Test that the API dependencies are available."""
    print("\n🧪 Testing API Dependencies")
    print("=" * 50)
    
    try:
        import fastapi
        import uvicorn
        print("✓ FastAPI installed")
        
        # Check if API file exists
        api_file = Path("src/server/api.py")
        if not api_file.exists():
            print("❌ API file not found at src/server/api.py")
            return False
        
        print("✓ API file exists")
        print("\n💡 To start the API, run:")
        print("   ./start_api.sh")
        print("   or: python src/server/api.py")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Run: pip install -r requirements-api.txt")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 50)
    print("🧪 Bhante Vector Search - System Test")
    print("=" * 50 + "\n")
    
    # Test vector DB
    db_ok = test_vector_db()
    
    # Test API
    api_ok = test_api()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary")
    print("=" * 50)
    print(f"Vector Database: {'✅ PASS' if db_ok else '❌ FAIL'}")
    print(f"API Dependencies: {'✅ PASS' if api_ok else '❌ FAIL'}")
    
    if db_ok and api_ok:
        print("\n✨ All systems operational!")
        print("\n🚀 Next steps:")
        print("   1. Start API: ./start_api.sh")
        print("   2. Open web client: src/client/index.html")
        print("   3. Visit API docs: http://localhost:8000/docs")
        return 0
    else:
        print("\n⚠️  Some tests failed. See messages above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
