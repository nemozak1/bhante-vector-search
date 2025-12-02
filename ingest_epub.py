#!/usr/bin/env python3
"""
EPUB Ingestion Script

This script processes EPUB files and populates ChromaDB with vectorized chunks.
It extracts text with page references and creates searchable documents.

Usage:
    python ingest_epub.py --epub-path ./data/your_file.epub
    python ingest_epub.py --epub-path ./data/your_file.epub --collection-name my_collection
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Dict, Tuple
from dotenv import load_dotenv

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from src.epub_processor import process_epub_to_langchain
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings


# Define work indexes for different volumes
WORK_INDEXES = {
    "complete_works_vol1": {
        "A Survey of Buddhism": (35, 611),
        "The Buddha's Noble Eightfold Path": (629, 792)
    },
    # Add more volumes as needed
    # "complete_works_vol2": {
    #     "Work Title": (start_page, end_page),
    # }
}


def validate_environment():
    """Validate that required environment variables are set."""
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not found in environment")
        print("Please create a .env file with your OpenAI API key:")
        print("  OPENAI_API_KEY=your_key_here")
        sys.exit(1)


def ingest_epub(
    epub_path: str,
    collection_name: str = "bhante_epub_search",
    persist_directory: str = "./chroma",
    work_index_name: str = "complete_works_vol1",
    max_chunk_size: int = 500,
    embedding_model: str = "text-embedding-3-large",
    batch_size: int = 100
):
    """
    Ingest an EPUB file into ChromaDB.
    
    Args:
        epub_path: Path to the EPUB file
        collection_name: Name for the ChromaDB collection
        persist_directory: Directory to store ChromaDB data
        work_index_name: Name of the work index to use (from WORK_INDEXES)
        max_chunk_size: Maximum characters per chunk
        embedding_model: OpenAI embedding model to use
        batch_size: Number of documents to add at once
    """
    print("=" * 70)
    print("📚 EPUB Ingestion Script")
    print("=" * 70)
    
    # Validate inputs
    epub_file = Path(epub_path)
    if not epub_file.exists():
        print(f"❌ Error: EPUB file not found: {epub_file}")
        sys.exit(1)
    
    if work_index_name not in WORK_INDEXES:
        print(f"❌ Error: Unknown work index: {work_index_name}")
        print(f"Available indexes: {list(WORK_INDEXES.keys())}")
        sys.exit(1)
    
    work_index = WORK_INDEXES[work_index_name]
    
    print(f"\n📖 Processing EPUB: {epub_file.name}")
    print(f"📊 Collection: {collection_name}")
    print(f"💾 Storage: {persist_directory}")
    print(f"🔧 Chunk size: {max_chunk_size} characters")
    print(f"🤖 Embedding model: {embedding_model}")
    print(f"\n📚 Work Index ({work_index_name}):")
    for title, (start, end) in work_index.items():
        print(f"   • {title}: pages {start}-{end}")
    
    # Process EPUB
    print(f"\n⚙️  Processing EPUB file...")
    try:
        documents = process_epub_to_langchain(
            epub_path=str(epub_file),
            work_index=work_index,
            max_chunk_size=max_chunk_size
        )
        print(f"✅ Extracted {len(documents)} document chunks")
    except Exception as e:
        print(f"❌ Error processing EPUB: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Show sample document
    if documents:
        print(f"\n📄 Sample document:")
        sample = documents[0]
        print(f"   Content: {sample.page_content[:150]}...")
        print(f"   Metadata: {sample.metadata}")
    
    # Initialize embeddings
    print(f"\n🔄 Initializing embeddings ({embedding_model})...")
    try:
        embeddings = OpenAIEmbeddings(model=embedding_model)
    except Exception as e:
        print(f"❌ Error initializing embeddings: {e}")
        print("Make sure your OPENAI_API_KEY is set correctly")
        sys.exit(1)
    
    # Create or connect to ChromaDB
    print(f"\n💾 Connecting to ChromaDB...")
    persist_path = Path(persist_directory)
    persist_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # Check if collection exists
        import chromadb
        from chromadb.config import DEFAULT_TENANT, DEFAULT_DATABASE, Settings
        
        chroma_client = chromadb.PersistentClient(
            path=str(persist_path),
            settings=Settings(),
            tenant=DEFAULT_TENANT,
            database=DEFAULT_DATABASE,
        )
        
        # Check if collection already exists
        existing_collections = [col.name for col in chroma_client.list_collections()]
        collection_exists = collection_name in existing_collections
        
        if collection_exists:
            print(f"⚠️  Collection '{collection_name}' already exists")
            response = input("Do you want to (a)ppend to it, (r)eplace it, or (c)ancel? [a/r/c]: ")
            
            if response.lower() == 'c':
                print("❌ Cancelled by user")
                sys.exit(0)
            elif response.lower() == 'r':
                print(f"🗑️  Deleting existing collection...")
                chroma_client.delete_collection(collection_name)
                collection_exists = False
        
        # Create vector store
        print(f"🔄 Creating vector store...")
        
        if collection_exists:
            # Append to existing collection
            vector_store = Chroma(
                client=chroma_client,
                collection_name=collection_name,
                embedding_function=embeddings,
            )
            
            # Add documents in batches
            print(f"📝 Adding {len(documents)} documents in batches of {batch_size}...")
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i+batch_size]
                vector_store.add_documents(batch)
                print(f"   Added batch {i//batch_size + 1}/{(len(documents)-1)//batch_size + 1}")
        else:
            # Create new collection
            print(f"📝 Creating new collection and adding {len(documents)} documents...")
            vector_store = Chroma.from_documents(
                documents=documents,
                embedding=embeddings,
                collection_name=collection_name,
                client=chroma_client,
            )
        
        print(f"✅ Successfully added documents to ChromaDB")
        
    except Exception as e:
        print(f"❌ Error with ChromaDB: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Test the vector store
    print(f"\n🔍 Testing vector search...")
    try:
        test_query = "What is a kalpa?"
        results = vector_store.similarity_search(test_query, k=3)
        print(f"✅ Search test successful! Found {len(results)} results for: '{test_query}'")
        
        if results:
            print(f"\n📄 Top result:")
            top_result = results[0]
            print(f"   Content: {top_result.page_content[:200]}...")
            print(f"   Metadata: {top_result.metadata}")
    except Exception as e:
        print(f"⚠️  Warning: Search test failed: {e}")
    
    # Summary
    print(f"\n" + "=" * 70)
    print("✨ Ingestion Complete!")
    print("=" * 70)
    print(f"📊 Collection: {collection_name}")
    print(f"📝 Documents: {len(documents)}")
    print(f"💾 Location: {persist_path.absolute()}")
    print(f"\n🚀 Next steps:")
    print(f"   1. Start the API: ./start_api.sh")
    print(f"   2. Visit: http://localhost:8000/docs")
    print(f"   3. Open the web client: src/client/index.html")
    print("=" * 70)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest EPUB files into ChromaDB for semantic search",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python ingest_epub.py --epub-path ./data/my_book.epub
  
  # Custom collection name
  python ingest_epub.py --epub-path ./data/my_book.epub --collection-name my_texts
  
  # Smaller chunks
  python ingest_epub.py --epub-path ./data/my_book.epub --chunk-size 300
  
  # Different work index
  python ingest_epub.py --epub-path ./data/my_book.epub --work-index complete_works_vol2
        """
    )
    
    parser.add_argument(
        "--epub-path",
        required=True,
        help="Path to the EPUB file to ingest"
    )
    
    parser.add_argument(
        "--collection-name",
        default="bhante_epub_search",
        help="Name for the ChromaDB collection (default: bhante_epub_search)"
    )
    
    parser.add_argument(
        "--persist-dir",
        default="./chroma",
        help="Directory to store ChromaDB data (default: ./chroma)"
    )
    
    parser.add_argument(
        "--work-index",
        default="complete_works_vol1",
        choices=list(WORK_INDEXES.keys()),
        help="Work index to use for page mapping (default: complete_works_vol1)"
    )
    
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=500,
        help="Maximum characters per chunk (default: 500)"
    )
    
    parser.add_argument(
        "--embedding-model",
        default="text-embedding-3-large",
        help="OpenAI embedding model (default: text-embedding-3-large)"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of documents to add at once (default: 100)"
    )
    
    args = parser.parse_args()
    
    # Load environment variables
    load_dotenv()
    validate_environment()
    
    # Run ingestion
    ingest_epub(
        epub_path=args.epub_path,
        collection_name=args.collection_name,
        persist_directory=args.persist_dir,
        work_index_name=args.work_index,
        max_chunk_size=args.chunk_size,
        embedding_model=args.embedding_model,
        batch_size=args.batch_size
    )


if __name__ == "__main__":
    main()
