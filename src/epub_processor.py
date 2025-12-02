"""
EPUB processor that extracts text chunks with page number references.

This module processes EPUB files to create searchable chunks while preserving
page number references from the original text.
"""

import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import re


@dataclass
class TextChunk:
    """Represents a chunk of text with its page reference."""
    text: str
    page_number: Optional[int]
    chapter_title: Optional[str]
    work_title: Optional[str]
    

class EPUBProcessor:
    """Process EPUB files to extract text chunks with page references."""
    
    def __init__(self, epub_path: str, max_chunk_size: int = 500):
        """
        Initialize the EPUB processor.
        
        Args:
            epub_path: Path to the EPUB file
            max_chunk_size: Maximum character count per chunk
        """
        self.epub_path = epub_path
        self.max_chunk_size = max_chunk_size
        self.book = epub.read_epub(epub_path)
        
    def extract_page_number(self, element) -> Optional[int]:
        """
        Extract page number from an anchor element.
        
        Args:
            element: BeautifulSoup element to check for page anchor
            
        Returns:
            Page number if found, None otherwise
        """
        # Look for anchor tags with id like "page_XXX"
        page_anchor = element.find('a', id=re.compile(r'page_\d+'))
        if page_anchor:
            page_id = page_anchor.get('id', '')
            match = re.search(r'page_(\d+)', page_id)
            if match:
                return int(match.group(1))
        return None
    
    def extract_chapter_title(self, soup: BeautifulSoup) -> Optional[str]:
        """
        Extract chapter title from the parsed HTML.
        
        Args:
            soup: BeautifulSoup object of the chapter
            
        Returns:
            Chapter title if found, None otherwise
        """
        # Look for common chapter title patterns
        title_patterns = [
            {'class_': 'chapter-header'},
            {'class_': 'chapter-title'},
            {'name': 'h1'},
            {'name': 'h2'}
        ]
        
        for pattern in title_patterns:
            title_elem = soup.find(**pattern)
            if title_elem:
                return title_elem.get_text().strip()
        return None
    
    def split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences while preserving structure.
        
        Args:
            text: Text to split
            
        Returns:
            List of sentences
        """
        # Simple sentence splitting - can be enhanced with nltk or spacy
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def create_chunks(self, text: str, page_number: Optional[int], 
                     chapter_title: Optional[str]) -> List[TextChunk]:
        """
        Create text chunks from a longer text segment.
        
        Args:
            text: Text to chunk
            page_number: Current page number
            chapter_title: Current chapter title
            
        Returns:
            List of TextChunk objects
        """
        chunks = []
        sentences = self.split_into_sentences(text)
        
        current_chunk = ""
        for sentence in sentences:
            # Check if adding this sentence would exceed max size
            if len(current_chunk) + len(sentence) + 1 <= self.max_chunk_size:
                current_chunk += sentence + " "
            else:
                # Save current chunk and start new one
                if current_chunk.strip():
                    chunks.append(TextChunk(
                        text=current_chunk.strip(),
                        page_number=page_number,
                        chapter_title=chapter_title,
                        work_title=None  # To be set later
                    ))
                current_chunk = sentence + " "
        
        # Don't forget the last chunk
        if current_chunk.strip():
            chunks.append(TextChunk(
                text=current_chunk.strip(),
                page_number=page_number,
                chapter_title=chapter_title,
                work_title=None
            ))
        
        return chunks
    
    def process_document(self, item) -> List[TextChunk]:
        """
        Process a single document item from the EPUB.
        
        Args:
            item: EPUB item to process
            
        Returns:
            List of TextChunk objects
        """
        chunks = []
        
        # Parse the HTML content
        content = item.get_content()
        soup = BeautifulSoup(content, 'html.parser')
        
        # Extract chapter title
        chapter_title = self.extract_chapter_title(soup)
        
        # Find the body or main content div
        body = soup.find('body') or soup.find('div')
        if not body:
            return chunks
        
        current_page = None
        current_text = ""
        
        # Process each element in order
        for element in body.descendants:
            # Check if this element contains a page anchor
            if element.name == 'a' and element.get('id', '').startswith('page_'):
                page_match = re.search(r'page_(\d+)', element.get('id', ''))
                if page_match:
                    # Save previous chunk if exists
                    if current_text.strip():
                        chunks.extend(self.create_chunks(
                            current_text.strip(), 
                            current_page, 
                            chapter_title
                        ))
                        current_text = ""
                    
                    # Update current page
                    current_page = int(page_match.group(1))
            
            # Collect text content
            elif isinstance(element, str):
                text = element.strip()
                if text:
                    current_text += text + " "
        
        # Process any remaining text
        if current_text.strip():
            chunks.extend(self.create_chunks(
                current_text.strip(), 
                current_page, 
                chapter_title
            ))
        
        return chunks
    
    def process_epub(self) -> List[TextChunk]:
        """
        Process the entire EPUB file.
        
        Returns:
            List of all TextChunk objects from the EPUB
        """
        all_chunks = []
        
        # Get all document items
        items = [item for item in self.book.get_items() 
                if item.get_type() == ebooklib.ITEM_DOCUMENT]
        
        for item in items:
            try:
                chunks = self.process_document(item)
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"Error processing {item.get_name()}: {e}")
                continue
        
        return all_chunks
    
    def resolve_work_title(self, chunk: TextChunk, 
                          work_index: Dict[str, Tuple[int, int]]) -> None:
        """
        Resolve which work a chunk belongs to based on page number.
        
        Args:
            chunk: TextChunk to update
            work_index: Dictionary mapping work titles to page ranges
        """
        if chunk.page_number is None:
            return
        
        for work_title, (start_page, end_page) in work_index.items():
            if start_page <= chunk.page_number < end_page:
                chunk.work_title = work_title
                break


def process_epub_to_langchain(epub_path: str, 
                               work_index: Optional[Dict[str, Tuple[int, int]]] = None,
                               max_chunk_size: int = 1000):
    """
    Process EPUB file and convert to LangChain Document format.
    
    Args:
        epub_path: Path to EPUB file
        work_index: Optional dictionary mapping work titles to page ranges
        max_chunk_size: Maximum size of text chunks
        
    Returns:
        List of LangChain Document objects
    """
    from langchain_core.documents import Document
    
    processor = EPUBProcessor(epub_path, max_chunk_size)
    chunks = processor.process_epub()
    
    # Resolve work titles if index provided
    if work_index:
        for chunk in chunks:
            processor.resolve_work_title(chunk, work_index)
    
    # Convert to LangChain Documents
    documents = []
    for chunk in chunks:
        metadata = {
            'source': epub_path,
        }
        
        if chunk.page_number is not None:
            metadata['page'] = chunk.page_number
            metadata['page_label'] = str(chunk.page_number)
        
        if chunk.chapter_title:
            metadata['chapter'] = chunk.chapter_title
        
        if chunk.work_title:
            metadata['work'] = chunk.work_title
        
        documents.append(Document(
            page_content=chunk.text,
            metadata=metadata
        ))
    
    return documents
