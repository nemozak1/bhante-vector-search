"""
FastAPI server for semantic search of Buddhist texts.

This API provides endpoints for searching through vectorized Buddhist text chunks
with proper page references and metadata.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Bhante Sangharakshita Vector Search API",
    description="Semantic search API for Buddhist texts with page references",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize embeddings and vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vector_store = None


# Pydantic models
class SearchRequest(BaseModel):
    """Request model for search queries."""
    query: str = Field(..., description="The search query text", min_length=1)
    k: int = Field(default=5, description="Number of results to return", ge=1, le=20)
    filter: Optional[Dict[str, Any]] = Field(None, description="Metadata filters")


class SearchResult(BaseModel):
    """Model for a single search result."""
    content: str = Field(..., description="The text content of the result")
    page: Optional[int] = Field(None, description="Page number in the original work")
    page_label: Optional[str] = Field(None, description="Page label from the original work")
    chapter: Optional[str] = Field(None, description="Chapter title")
    work: Optional[str] = Field(None, description="Title of the work")
    score: Optional[float] = Field(None, description="Relevance score")


class SearchResponse(BaseModel):
    """Response model for search queries."""
    query: str
    results: List[SearchResult]
    total_results: int


@app.on_event("startup")
async def startup_event():
    """Initialize vector store on startup."""
    global vector_store
    
    collection_name = "bhante_epub_search"
    persist_directory = "./chroma"
    
    try:
        vector_store = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=persist_directory
        )
        print(f"✓ Connected to ChromaDB collection: {collection_name}")
    except Exception as e:
        print(f"✗ Error connecting to ChromaDB: {e}")
        raise


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Bhante Sangharakshita Vector Search API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "search": "/api/search",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "vector_store_connected": vector_store is not None
    }


@app.post("/api/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    Perform semantic search on the Buddhist texts.
    
    Args:
        request: SearchRequest containing query and parameters
        
    Returns:
        SearchResponse with matching results
    """
    if vector_store is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    
    try:
        # Perform similarity search
        results = vector_store.similarity_search_with_score(
            request.query,
            k=request.k,
            filter=request.filter
        )
        
        # Format results
        search_results = []
        for doc, score in results:
            search_results.append(SearchResult(
                content=doc.page_content,
                page=doc.metadata.get("page"),
                page_label=doc.metadata.get("page_label"),
                chapter=doc.metadata.get("chapter"),
                work=doc.metadata.get("work"),
                score=float(score)
            ))
        
        return SearchResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.get("/api/search", response_model=SearchResponse)
async def search_get(
    query: str = Query(..., description="The search query text"),
    k: int = Query(default=5, description="Number of results", ge=1, le=20)
):
    """
    GET endpoint for semantic search (alternative to POST).
    
    Args:
        query: Search query string
        k: Number of results to return
        
    Returns:
        SearchResponse with matching results
    """
    request = SearchRequest(query=query, k=k)
    return await search(request)


@app.get("/api/works")
async def list_works():
    """
    List all available works in the collection.
    
    Returns:
        List of works with their page ranges
    """
    return {
        "works": [
            {
                "title": "A Survey of Buddhism",
                "page_range": [35, 611]
            },
            {
                "title": "The Buddha's Noble Eightfold Path",
                "page_range": [629, 792]
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
