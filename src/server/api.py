"""
FastAPI server for semantic search of Buddhist texts.

This API provides endpoints for searching through vectorized Buddhist text chunks
with proper page references and metadata. Supports both EPUB books and seminar
transcripts.
"""

from fastapi import Depends, FastAPI, HTTPException, Query
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

from src.server.auth import CurrentUser, get_current_user  # noqa: E402

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
async def search(request: SearchRequest, user: CurrentUser = Depends(get_current_user)):
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
    user: CurrentUser = Depends(get_current_user),
):
    """GET endpoint for semantic search on books."""
    request = SearchRequest(query=query, k=k)
    return await search(request, user=user)


@app.get("/api/works")
async def list_works(user: CurrentUser = Depends(get_current_user)):
    """List all available works in the epub collection."""
    return {
        "works": [
            {"title": "A Survey of Buddhism", "page_range": [35, 611]},
            {"title": "The Buddha's Noble Eightfold Path", "page_range": [629, 792]},
        ]
    }


# ── Seminar search ───────────────────────────────────────────────────

@app.post("/api/seminars/search", response_model=SeminarSearchResponse)
async def search_seminars(request: SearchRequest, user: CurrentUser = Depends(get_current_user)):
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
    user: CurrentUser = Depends(get_current_user),
):
    """GET endpoint for semantic search on seminars."""
    request = SearchRequest(query=query, k=k)
    return await search_seminars(request, user=user)


@app.get("/api/seminars")
async def list_seminars(user: CurrentUser = Depends(get_current_user)):
    """List all available seminars from cleaned/raw files on disk."""
    import json as json_module

    seminars = {}

    # Prefer cleaned versions
    cleaned_dir = PROJECT_ROOT / "data" / "seminars" / "cleaned"
    if cleaned_dir.exists():
        for path in cleaned_dir.glob("*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json_module.load(f)
                code = data.get("code", path.stem)
                seminars[code] = {
                    "code": code,
                    "title": data.get("title", ""),
                    "date": data.get("date"),
                    "location": data.get("location"),
                }
            except Exception:
                continue

    # Fill in any raw-only seminars not already covered by cleaned
    raw_dir = PROJECT_ROOT / "data" / "seminars" / "raw"
    if raw_dir.exists():
        for path in raw_dir.glob("*.json"):
            code = path.stem
            if code in seminars:
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json_module.load(f)
                seminars[code] = {
                    "code": code,
                    "title": data.get("title", ""),
                    "date": data.get("date"),
                    "location": data.get("location"),
                }
            except Exception:
                continue

    return {
        "seminars": sorted(seminars.values(), key=lambda s: s["code"]),
        "total": len(seminars),
    }


@app.get("/api/review/status")
async def get_review_status(user: CurrentUser = Depends(get_current_user)):
    """Return seminar review status for the review dashboard."""
    import json as json_module

    status_path = PROJECT_ROOT / "data" / "seminars" / "review_status.json"
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Review status file not found")
    with open(status_path, "r", encoding="utf-8") as f:
        return json_module.load(f)


@app.get("/api/review/{code}/diff")
async def get_review_diff(code: str, user: CurrentUser = Depends(get_current_user)):
    """Return a unified text diff between raw parse and cleaned file."""
    import json as json_module
    import difflib
    from src.seminar_processor import SeminarProcessor

    cleaned_path = PROJECT_ROOT / "data" / "seminars" / "cleaned" / f"{code}.json"
    raw_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}.json"

    if not cleaned_path.exists():
        raise HTTPException(status_code=404, detail=f"No cleaned file for {code}")
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail=f"No raw file for {code}")

    # Load cleaned version
    with open(cleaned_path, "r", encoding="utf-8") as f:
        cleaned = json_module.load(f)

    # Parse raw fresh
    processor = SeminarProcessor()
    raw_result = processor.process_for_display(raw_path)

    def turns_to_text(turns, date=None, location=None):
        """Convert turns to a readable text format for diffing."""
        lines = []
        if date:
            lines.append(f"Date: {date}")
        if location:
            lines.append(f"Location: {location}")
        if lines:
            lines.append("")
        for t in turns:
            speaker = t.get("speaker") if isinstance(t, dict) else t.speaker
            paragraphs = t.get("paragraphs", []) if isinstance(t, dict) else t.paragraphs
            name = speaker or "(unattributed)"
            lines.append(f"[{name}]")
            for p in paragraphs:
                # Truncate very long paragraphs for readability
                if len(p) > 200:
                    lines.append(f"  {p[:200]}...")
                else:
                    lines.append(f"  {p}")
            lines.append("")
        return lines

    raw_lines = turns_to_text(
        raw_result["turns"],
        date=raw_result.get("date"),
        location=raw_result.get("location"),
    )
    cleaned_lines = turns_to_text(
        cleaned.get("turns", []),
        date=cleaned.get("date"),
        location=cleaned.get("location"),
    )

    diff_lines = list(difflib.unified_diff(
        raw_lines,
        cleaned_lines,
        fromfile=f"{code} (raw parse)",
        tofile=f"{code} (cleaned)",
        lineterm="",
    ))

    return {
        "code": code,
        "title": cleaned.get("title", ""),
        "raw_turn_count": len(raw_result["turns"]),
        "cleaned_turn_count": len(cleaned.get("turns", [])),
        "diff_lines": diff_lines,
        "has_changes": len(diff_lines) > 0,
    }


@app.get("/api/seminars/{code}", response_model=SeminarTranscriptResponse)
async def get_seminar_transcript(code: str, user: CurrentUser = Depends(get_current_user)):
    """Get the full transcript of a seminar for the viewer.

    Prefers cleaned (reviewed) version if available, otherwise parses raw on-the-fly.
    """
    import json as json_module

    # Prefer cleaned version if it exists
    cleaned_path = PROJECT_ROOT / "data" / "seminars" / "cleaned" / f"{code}.json"
    if cleaned_path.exists():
        try:
            with open(cleaned_path, "r", encoding="utf-8") as f:
                data = json_module.load(f)
            turns = [
                SpeakerTurnResponse(
                    speaker=t.get("speaker"),
                    paragraphs=t["paragraphs"],
                    turn_index=i,
                )
                for i, t in enumerate(data["turns"])
            ]
            return SeminarTranscriptResponse(
                code=data["code"],
                title=data["title"],
                date=data.get("date"),
                location=data.get("location"),
                turns=turns,
            )
        except Exception as e:
            logger.warning(f"Error reading cleaned file for {code}, falling back to raw: {e}")

    # Fall back to parsing raw on-the-fly
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


# ── Seminar export ───────────────────────────────────────────────────


def _load_seminar_data(code: str) -> dict:
    """Load seminar data from cleaned or raw files. Returns dict with code, title, date, location, turns."""
    import json as json_module

    cleaned_path = PROJECT_ROOT / "data" / "seminars" / "cleaned" / f"{code}.json"
    if cleaned_path.exists():
        with open(cleaned_path, "r", encoding="utf-8") as f:
            return json_module.load(f)

    raw_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}.json"
    if raw_path.exists():
        from src.seminar_processor import SeminarProcessor
        processor = SeminarProcessor()
        result = processor.process_for_display(raw_path)
        return {
            "code": result["code"],
            "title": result["title"],
            "date": result["date"],
            "location": result["location"],
            "turns": [
                {"speaker": t.speaker, "paragraphs": t.paragraphs}
                for t in result["turns"]
            ],
        }

    raise HTTPException(status_code=404, detail=f"Seminar {code} not found")


def _seminar_to_html(data: dict, for_print: bool = False) -> str:
    """Render seminar data to standalone HTML."""
    title = data.get("title", "")
    date = data.get("date", "")
    location = data.get("location", "")

    subtitle_parts = []
    if date:
        subtitle_parts.append(date)
    if location:
        subtitle_parts.append(location)
    subtitle = " — ".join(subtitle_parts)

    turns_html = []
    for turn in data.get("turns", []):
        speaker = turn.get("speaker", "")
        paragraphs = turn.get("paragraphs", [])
        paras = "".join(f"<p>{p}</p>" for p in paragraphs)
        speaker_class = " sangharakshita" if speaker == "Sangharakshita" else ""
        speaker_el = f'<div class="speaker">{speaker}</div>' if speaker else ""
        turns_html.append(f'<div class="turn{speaker_class}">{speaker_el}<div class="body">{paras}</div></div>')

    print_style = ""
    if for_print:
        print_style = """
        @media print {
            body { font-size: 11pt; }
            .turn { page-break-inside: avoid; }
        }
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Georgia', 'Times New Roman', serif; color: #2c2418; line-height: 1.8; max-width: 700px; margin: 0 auto; padding: 2rem 1.5rem; }}
  h1 {{ font-size: 1.6rem; font-weight: 500; margin-bottom: 0.4rem; }}
  .subtitle {{ font-family: sans-serif; font-size: 0.88rem; color: #8c7e6a; margin-bottom: 2rem; }}
  .turn {{ margin-bottom: 1.4rem; padding-left: 1rem; border-left: 2px solid transparent; }}
  .turn.sangharakshita {{ border-left-color: #5a7247; }}
  .speaker {{ font-family: sans-serif; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a7247; margin-bottom: 0.25rem; }}
  .body {{ font-size: 1.1rem; }}
  .body p {{ margin-bottom: 0.5em; }}
  .body p:last-child {{ margin-bottom: 0; }}
  .source {{ margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e8e3da; font-family: sans-serif; font-size: 0.75rem; color: #8c7e6a; }}
  {print_style}
</style>
</head>
<body>
  <h1>{title}</h1>
  {"<p class='subtitle'>" + subtitle + "</p>" if subtitle else ""}
  {"".join(turns_html)}
  <div class="source">Source: Free Buddhist Audio — freebuddhistaudio.com</div>
</body>
</html>"""


@app.get("/api/seminars/{code}/pdf")
async def export_seminar_pdf(code: str, user: CurrentUser = Depends(get_current_user)):
    """Export a seminar transcript as PDF."""
    from fastapi.responses import Response
    from xhtml2pdf import pisa
    import io

    data = _load_seminar_data(code)
    html = _seminar_to_html(data)
    buf = io.BytesIO()
    pisa_status = pisa.CreatePDF(html, dest=buf)
    if pisa_status.err:
        raise HTTPException(status_code=500, detail="PDF generation failed")
    buf.seek(0)

    filename = f"{code} - {data.get('title', code)}.pdf"
    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/seminars/{code}/epub")
async def export_seminar_epub(code: str, user: CurrentUser = Depends(get_current_user)):
    """Export a seminar transcript as EPUB."""
    from fastapi.responses import Response
    from ebooklib import epub
    import io

    data = _load_seminar_data(code)
    title = data.get("title", code)
    date = data.get("date", "")
    location = data.get("location", "")

    book = epub.EpubBook()
    book.set_identifier(f"sangharakshita-seminar-{code}")
    book.set_title(title)
    book.set_language("en")
    book.add_author("Sangharakshita")

    # Build chapter HTML
    subtitle_parts = []
    if date:
        subtitle_parts.append(date)
    if location:
        subtitle_parts.append(location)

    body_parts = [f"<h1>{title}</h1>"]
    if subtitle_parts:
        body_parts.append(f"<p><em>{' — '.join(subtitle_parts)}</em></p>")
    body_parts.append("<hr/>")

    for turn in data.get("turns", []):
        speaker = turn.get("speaker", "")
        if speaker:
            body_parts.append(f'<p><strong>{speaker}</strong></p>')
        for p in turn.get("paragraphs", []):
            body_parts.append(f"<p>{p}</p>")

    chapter = epub.EpubHtml(title=title, file_name="transcript.xhtml", lang="en")
    chapter.content = "\n".join(body_parts)

    style = epub.EpubItem(
        uid="style",
        file_name="style/default.css",
        media_type="text/css",
        content=b"body { font-family: serif; line-height: 1.8; } strong { font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em; }",
    )
    book.add_item(style)
    chapter.add_item(style)
    book.add_item(chapter)
    book.spine = ["nav", chapter]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.toc = [chapter]

    buf = io.BytesIO()
    epub.write_epub(buf, book, {})
    buf.seek(0)

    filename = f"{code} - {title}.epub"
    return Response(
        content=buf.read(),
        media_type="application/epub+zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/seminars/{code}/print")
async def print_seminar(code: str, user: CurrentUser = Depends(get_current_user)):
    """Return a print-friendly HTML page for a seminar."""
    from fastapi.responses import HTMLResponse

    data = _load_seminar_data(code)
    html = _seminar_to_html(data, for_print=True)
    return HTMLResponse(content=html)


# ── Unified search ───────────────────────────────────────────────────

@app.post("/api/search/all", response_model=UnifiedSearchResponse)
async def search_all(request: SearchRequest, user: CurrentUser = Depends(get_current_user)):
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
    user: CurrentUser = Depends(get_current_user),
):
    """GET endpoint for unified search across all collections."""
    request = SearchRequest(query=query, k=k)
    return await search_all(request, user=user)


# ── Static files (SvelteKit build) ───────────────────────────────────

# Mount SvelteKit build output if it exists
client_build = Path(__file__).parent.parent / "client" / "build"
if client_build.exists():
    app.mount("/", StaticFiles(directory=str(client_build), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
