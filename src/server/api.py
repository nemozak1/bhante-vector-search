"""
FastAPI server for semantic search of Buddhist texts.

This API provides endpoints for searching through vectorized Buddhist text chunks
with proper page references and metadata. Supports both EPUB books and seminar
transcripts.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from pathlib import Path
import logging
import os
import sys
from dotenv import load_dotenv

# Ensure project root is on sys.path so we can import src.*
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables
load_dotenv(PROJECT_ROOT / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Bhante Sangharakshita Vector Search API",
    description="Semantic search API for Buddhist texts and seminar transcripts",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize embeddings and vector stores
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
epub_store = None
seminar_store = None


# ── Pydantic models ───────────────────────────────────────────────────

class SearchRequest(BaseModel):
    """Request model for search queries."""
    query: str = Field(..., description="The search query text", min_length=1)
    k: int = Field(default=5, description="Number of results to return", ge=1, le=20)
    filter: Optional[Dict[str, Any]] = Field(None, description="Metadata filters")


class SearchResult(BaseModel):
    """Model for a book search result."""
    content: str = Field(..., description="The text content of the result")
    page: Optional[int] = Field(None, description="Page number in the original work")
    page_label: Optional[str] = Field(None, description="Page label from the original work")
    chapter: Optional[str] = Field(None, description="Chapter title")
    work: Optional[str] = Field(None, description="Title of the work")
    score: Optional[float] = Field(None, description="Relevance score")


class SearchResponse(BaseModel):
    """Response model for book search queries."""
    query: str
    results: List[SearchResult]
    total_results: int


class SpeakerTurnResponse(BaseModel):
    """A single speaker turn for the transcript viewer."""
    speaker: Optional[str] = None
    paragraphs: List[str]
    turn_index: int


class SeminarTranscriptResponse(BaseModel):
    """Full seminar transcript for the viewer."""
    code: str
    title: str
    date: Optional[str] = None
    location: Optional[str] = None
    turns: List[SpeakerTurnResponse]


class SeminarSearchResult(BaseModel):
    """Model for a seminar search result."""
    content: str
    seminar_title: Optional[str] = None
    seminar_code: Optional[str] = None
    speaker: Optional[str] = None
    section_heading: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    score: Optional[float] = None


class SeminarSearchResponse(BaseModel):
    """Response model for seminar search queries."""
    query: str
    results: List[SeminarSearchResult]
    total_results: int


class UnifiedSearchResult(BaseModel):
    """Model for a unified search result across both collections."""
    content: str
    content_type: str  # "epub" or "seminar"
    score: Optional[float] = None
    # Book fields
    page: Optional[int] = None
    page_label: Optional[str] = None
    chapter: Optional[str] = None
    work: Optional[str] = None
    # Seminar fields
    seminar_title: Optional[str] = None
    seminar_code: Optional[str] = None
    speaker: Optional[str] = None
    section_heading: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None


class UnifiedSearchResponse(BaseModel):
    """Response model for unified search queries."""
    query: str
    results: List[UnifiedSearchResult]
    total_results: int


# ── Startup ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize vector stores on startup."""
    global epub_store, seminar_store

    persist_directory = str(PROJECT_ROOT / "chroma")

    # Initialize epub store
    try:
        epub_store = Chroma(
            collection_name="bhante_epub_search",
            embedding_function=embeddings,
            persist_directory=persist_directory,
        )
        print(f"Connected to epub collection: bhante_epub_search")
    except Exception as e:
        print(f"Warning: Could not connect to epub collection: {e}")

    # Initialize seminar store (gracefully handle if missing)
    try:
        seminar_store = Chroma(
            collection_name="bhante_seminar_search",
            embedding_function=embeddings,
            persist_directory=persist_directory,
        )
        print(f"Connected to seminar collection: bhante_seminar_search")
    except Exception as e:
        print(f"Warning: Could not connect to seminar collection: {e}")


# ── General endpoints ─────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Bhante Sangharakshita Vector Search API",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "search_books": "/api/search",
            "search_seminars": "/api/seminars/search",
            "search_all": "/api/search/all",
            "works": "/api/works",
            "seminars": "/api/seminars",
            "health": "/health",
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "epub_store_connected": epub_store is not None,
        "seminar_store_connected": seminar_store is not None,
    }


# ── Book search (existing, unchanged) ────────────────────────────────

@app.post("/api/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Perform semantic search on the Buddhist texts (books)."""
    if epub_store is None:
        raise HTTPException(status_code=503, detail="Epub vector store not initialized")

    try:
        results = epub_store.similarity_search_with_score(
            request.query,
            k=request.k,
            filter=request.filter,
        )

        search_results = []
        for doc, score in results:
            search_results.append(SearchResult(
                content=doc.page_content,
                page=doc.metadata.get("page"),
                page_label=doc.metadata.get("page_label"),
                chapter=doc.metadata.get("chapter"),
                work=doc.metadata.get("work"),
                score=float(score),
            ))

        return SearchResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.get("/api/search", response_model=SearchResponse)
async def search_get(
    query: str = Query(..., description="The search query text"),
    k: int = Query(default=5, description="Number of results", ge=1, le=20),
):
    """GET endpoint for semantic search on books."""
    request = SearchRequest(query=query, k=k)
    return await search(request)


@app.get("/api/works")
async def list_works():
    """List all available works in the epub collection."""
    return {
        "works": [
            {"title": "A Survey of Buddhism", "page_range": [35, 611]},
            {"title": "The Buddha's Noble Eightfold Path", "page_range": [629, 792]},
        ]
    }


# ── Seminar search ───────────────────────────────────────────────────

@app.post("/api/seminars/search", response_model=SeminarSearchResponse)
async def search_seminars(request: SearchRequest):
    """Perform semantic search on seminar transcripts."""
    if seminar_store is None:
        raise HTTPException(status_code=503, detail="Seminar vector store not initialized")

    try:
        results = seminar_store.similarity_search_with_score(
            request.query,
            k=request.k,
            filter=request.filter,
        )

        search_results = []
        for doc, score in results:
            search_results.append(SeminarSearchResult(
                content=doc.page_content,
                seminar_title=doc.metadata.get("seminar_title"),
                seminar_code=doc.metadata.get("seminar_code"),
                speaker=doc.metadata.get("speaker"),
                section_heading=doc.metadata.get("section_heading"),
                date=doc.metadata.get("date"),
                location=doc.metadata.get("location"),
                score=float(score),
            ))

        return SeminarSearchResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.get("/api/seminars/search", response_model=SeminarSearchResponse)
async def search_seminars_get(
    query: str = Query(..., description="The search query text"),
    k: int = Query(default=5, description="Number of results", ge=1, le=20),
):
    """GET endpoint for semantic search on seminars."""
    request = SearchRequest(query=query, k=k)
    return await search_seminars(request)


@app.get("/api/seminars")
async def list_seminars():
    """List distinct seminars in the seminar collection."""
    if seminar_store is None:
        raise HTTPException(status_code=503, detail="Seminar vector store not initialized")

    try:
        collection = seminar_store._collection
        all_metadata = collection.get(include=["metadatas"])
        metadatas = all_metadata.get("metadatas", [])

        seminars = {}
        for meta in metadatas:
            code = meta.get("seminar_code")
            if code and code not in seminars:
                seminars[code] = {
                    "code": code,
                    "title": meta.get("seminar_title", ""),
                    "date": meta.get("date"),
                    "location": meta.get("location"),
                }

        return {
            "seminars": sorted(seminars.values(), key=lambda s: s["code"]),
            "total": len(seminars),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing seminars: {str(e)}")


@app.get("/api/seminars/{code}", response_model=SeminarTranscriptResponse)
async def get_seminar_transcript(code: str):
    """Get the full transcript of a seminar for the viewer."""
    from src.seminar_processor import SeminarProcessor

    raw_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}.json"
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail=f"Seminar {code} not found")

    try:
        processor = SeminarProcessor()
        result = processor.process_for_display(raw_path)

        turns = [
            SpeakerTurnResponse(
                speaker=t.speaker,
                paragraphs=t.paragraphs,
                turn_index=t.turn_index,
            )
            for t in result["turns"]
        ]

        return SeminarTranscriptResponse(
            code=result["code"],
            title=result["title"],
            date=result["date"],
            location=result["location"],
            turns=turns,
        )

    except Exception as e:
        logger.exception(f"Error processing seminar {code}")
        raise HTTPException(status_code=500, detail=f"Error processing seminar: {str(e)}")


# ── Unified search ───────────────────────────────────────────────────

@app.post("/api/search/all", response_model=UnifiedSearchResponse)
async def search_all(request: SearchRequest):
    """Search both book and seminar collections, merged by score."""
    results = []

    # Search epub store
    if epub_store is not None:
        try:
            epub_results = epub_store.similarity_search_with_score(
                request.query, k=request.k,
            )
            for doc, score in epub_results:
                results.append(UnifiedSearchResult(
                    content=doc.page_content,
                    content_type="epub",
                    score=float(score),
                    page=doc.metadata.get("page"),
                    page_label=doc.metadata.get("page_label"),
                    chapter=doc.metadata.get("chapter"),
                    work=doc.metadata.get("work"),
                ))
        except Exception:
            pass

    # Search seminar store
    if seminar_store is not None:
        try:
            sem_results = seminar_store.similarity_search_with_score(
                request.query, k=request.k,
            )
            for doc, score in sem_results:
                results.append(UnifiedSearchResult(
                    content=doc.page_content,
                    content_type="seminar",
                    score=float(score),
                    seminar_title=doc.metadata.get("seminar_title"),
                    seminar_code=doc.metadata.get("seminar_code"),
                    speaker=doc.metadata.get("speaker"),
                    section_heading=doc.metadata.get("section_heading"),
                    date=doc.metadata.get("date"),
                    location=doc.metadata.get("location"),
                ))
        except Exception:
            pass

    if not results:
        raise HTTPException(status_code=503, detail="No vector stores available")

    # Sort by score (lower is better for ChromaDB distance)
    results.sort(key=lambda r: r.score if r.score is not None else float("inf"))
    results = results[:request.k]

    return UnifiedSearchResponse(
        query=request.query,
        results=results,
        total_results=len(results),
    )


@app.get("/api/search/all", response_model=UnifiedSearchResponse)
async def search_all_get(
    query: str = Query(..., description="The search query text"),
    k: int = Query(default=5, description="Number of results", ge=1, le=20),
):
    """GET endpoint for unified search across all collections."""
    request = SearchRequest(query=query, k=k)
    return await search_all(request)


# ── Static files (SvelteKit build) ───────────────────────────────────

# Mount SvelteKit build output if it exists
client_build = Path(__file__).parent.parent / "client" / "build"
if client_build.exists():
    app.mount("/", StaticFiles(directory=str(client_build), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
