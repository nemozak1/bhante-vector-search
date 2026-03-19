#!/usr/bin/env python3
"""
Seminar Ingestion Script

Processes downloaded seminar transcripts and populates ChromaDB.

Usage:
    python ingest_seminars.py                         # ingest all downloaded
    python ingest_seminars.py --codes SEM050,SEM051   # specific ones
    python ingest_seminars.py --reprocess             # delete + re-add all
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

from src.seminar_processor import process_seminar_to_langchain


DEFAULT_DATA_DIR = Path("data/seminars")
DEFAULT_COLLECTION = "bhante_seminar_search"
DEFAULT_PERSIST_DIR = "./chroma"


def validate_environment():
    """Validate that required environment variables are set."""
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY not found in environment")
        print("Please create a .env file with your OpenAI API key")
        sys.exit(1)


def get_downloaded_codes(data_dir: Path) -> List[str]:
    """Get list of seminar codes that have been downloaded."""
    raw_dir = data_dir / "raw"
    if not raw_dir.exists():
        return []
    codes = []
    for f in sorted(raw_dir.glob("*.json")):
        code = f.stem
        if not code.endswith("C"):  # Skip contents versions
            codes.append(code)
    return codes


def load_ingest_log(data_dir: Path) -> dict:
    """Load the ingestion log."""
    path = data_dir / "ingest_log.json"
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return {}


def save_ingest_log(data_dir: Path, log: dict):
    """Save the ingestion log."""
    path = data_dir / "ingest_log.json"
    with open(path, "w") as f:
        json.dump(log, f, indent=2)


def ingest_seminars(
    data_dir: Path = DEFAULT_DATA_DIR,
    collection_name: str = DEFAULT_COLLECTION,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    codes: Optional[List[str]] = None,
    reprocess: bool = False,
    embedding_model: str = "text-embedding-3-large",
    batch_size: int = 100,
    max_chunk_size: int = 1000,
):
    """Ingest seminar transcripts into ChromaDB."""
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings
    import chromadb
    from chromadb.config import DEFAULT_TENANT, DEFAULT_DATABASE, Settings

    print("=" * 70)
    print("Seminar Ingestion")
    print("=" * 70)

    raw_dir = data_dir / "raw"

    # Determine which codes to process
    available_codes = get_downloaded_codes(data_dir)
    if codes:
        target_codes = [c for c in codes if c in available_codes]
        missing = set(codes) - set(available_codes)
        if missing:
            print(f"Warning: codes not found in raw/: {missing}")
    else:
        target_codes = available_codes

    if not target_codes:
        print("No seminar transcripts to ingest.")
        return

    ingest_log = load_ingest_log(data_dir)

    # Skip already ingested unless reprocessing
    if not reprocess:
        already_done = {
            code for code, info in ingest_log.items()
            if info.get("status") == "ingested"
        }
        target_codes = [c for c in target_codes if c not in already_done]
        if not target_codes:
            print("All seminars already ingested. Use --reprocess to re-ingest.")
            return

    print(f"Processing {len(target_codes)} seminars...")

    # Process all seminars into documents
    all_documents = []
    for code in target_codes:
        raw_path = raw_dir / f"{code}.json"
        contents_path = raw_dir / f"{code}C.json"
        c_path = contents_path if contents_path.exists() else None

        try:
            docs = process_seminar_to_langchain(
                str(raw_path),
                str(c_path) if c_path else None,
                max_chunk_size=max_chunk_size,
            )
            all_documents.extend(docs)
            ingest_log[code] = {
                "status": "ingested",
                "chunks": len(docs),
                "timestamp": datetime.now().isoformat(),
            }
            print(f"  {code}: {len(docs)} chunks")
        except Exception as e:
            ingest_log[code] = {
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }
            print(f"  {code}: FAILED - {e}")

    if not all_documents:
        print("No documents to ingest.")
        save_ingest_log(data_dir, ingest_log)
        return

    print(f"\nTotal documents: {len(all_documents)}")

    # Initialize embeddings
    print(f"Initializing embeddings ({embedding_model})...")
    embeddings = OpenAIEmbeddings(model=embedding_model)

    # Connect to ChromaDB
    print("Connecting to ChromaDB...")
    persist_path = Path(persist_directory)
    persist_path.mkdir(parents=True, exist_ok=True)

    chroma_client = chromadb.PersistentClient(
        path=str(persist_path),
        settings=Settings(),
        tenant=DEFAULT_TENANT,
        database=DEFAULT_DATABASE,
    )

    existing_collections = [col.name for col in chroma_client.list_collections()]

    if reprocess and collection_name in existing_collections:
        print(f"Deleting existing collection '{collection_name}'...")
        chroma_client.delete_collection(collection_name)

    if collection_name in existing_collections and not reprocess:
        # Append to existing
        vector_store = Chroma(
            client=chroma_client,
            collection_name=collection_name,
            embedding_function=embeddings,
        )
        print(f"Adding {len(all_documents)} documents in batches of {batch_size}...")
        for i in range(0, len(all_documents), batch_size):
            batch = all_documents[i:i + batch_size]
            vector_store.add_documents(batch)
            print(f"  Batch {i // batch_size + 1}/{(len(all_documents) - 1) // batch_size + 1}")
    else:
        # Create new collection
        print(f"Creating collection and adding {len(all_documents)} documents...")
        vector_store = Chroma.from_documents(
            documents=all_documents,
            embedding=embeddings,
            collection_name=collection_name,
            client=chroma_client,
        )

    print(f"Successfully added documents to ChromaDB")

    # Save log
    save_ingest_log(data_dir, ingest_log)

    # Summary
    print(f"\n" + "=" * 70)
    print("Ingestion Complete!")
    print("=" * 70)
    print(f"Collection: {collection_name}")
    print(f"Documents: {len(all_documents)}")
    print(f"Seminars: {len(target_codes)}")


def main():
    parser = argparse.ArgumentParser(
        description="Ingest seminar transcripts into ChromaDB"
    )
    parser.add_argument(
        "--codes",
        type=str,
        default=None,
        help="Comma-separated seminar codes (e.g. SEM050,SEM051)",
    )
    parser.add_argument(
        "--reprocess",
        action="store_true",
        help="Delete and re-add all seminars",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(DEFAULT_DATA_DIR),
        help=f"Data directory (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--collection-name",
        default=DEFAULT_COLLECTION,
        help=f"ChromaDB collection name (default: {DEFAULT_COLLECTION})",
    )
    parser.add_argument(
        "--persist-dir",
        default=DEFAULT_PERSIST_DIR,
        help=f"ChromaDB persist directory (default: {DEFAULT_PERSIST_DIR})",
    )
    parser.add_argument(
        "--embedding-model",
        default="text-embedding-3-large",
        help="OpenAI embedding model (default: text-embedding-3-large)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for document insertion (default: 100)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Maximum chunk size in characters (default: 1000)",
    )

    args = parser.parse_args()
    load_dotenv()
    validate_environment()

    codes = args.codes.split(",") if args.codes else None

    ingest_seminars(
        data_dir=Path(args.data_dir),
        collection_name=args.collection_name,
        persist_directory=args.persist_dir,
        codes=codes,
        reprocess=args.reprocess,
        embedding_model=args.embedding_model,
        batch_size=args.batch_size,
        max_chunk_size=args.chunk_size,
    )


if __name__ == "__main__":
    main()
