"""
Seminar transcript processor.

Processes downloaded seminar JSON files into chunked LangChain Documents
with speaker, section, and metadata information.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from bs4 import BeautifulSoup


# Known abbreviations for Sangharakshita
SANGHARAKSHITA_ALIASES = {"S", "S.", "Bhante", "Sangharakshita", "SANGHARAKSHITA"}

# Boilerplate intro text that appears in many transcripts
BOILERPLATE_STARTS = [
    "General Introduction to Sangharakshita's Seminars",
    "Hidden Treasure of the Dharma Cloud",
]

# Footer attribution patterns
FOOTER_PATTERNS = [
    re.compile(r"^(Handwritten|Retyped|Typed|Checked and Contented|"
               r"Printed and Distributed|Transcribed|Edited) by\b", re.IGNORECASE),
]

# Speaker turn pattern: "Name;" or "Name:" at start of paragraph text,
# optionally preceded by a page/section marker like "[5]"
# Matches names like "S", "Sangharakshita", "Roger Jones", "Sona", "__________"
SPEAKER_TURN_RE = re.compile(
    r'^(?:\[\d+\]\s+)?([A-Za-z_][A-Za-z\s_.\'-]*?)\s*[;:]\s+'
)

# Standalone page/section marker at start of line, e.g. "[5] Some text"
# Used to strip these markers from paragraph text when they don't contain a speaker
PAGE_MARKER_RE = re.compile(r'^\[(\d+)\]\s*')

# Maximum length for a speaker name — longer matches are likely false positives
MAX_SPEAKER_NAME_LENGTH = 40

# Header-like labels to exclude from speaker detection
HEADER_LABELS = {
    "HELD AT", "IN", "THOSE PRESENT", "PRESENT", "DATE", "PLACE",
    "LOCATION", "VENUE", "DAY", "SESSION", "TAPE", "SIDE",
    "NB", "N.B", "PLEASE NOTE", "NOTE",
}


@dataclass
class SpeakerTurn:
    """A single speaker turn for display (not chunked)."""
    speaker: Optional[str]
    paragraphs: List[str]
    turn_index: int


@dataclass
class SeminarChunk:
    """Represents a chunk of seminar transcript text."""
    text: str
    seminar_title: str
    seminar_code: str
    speaker: Optional[str] = None
    section_heading: Optional[str] = None


class SeminarProcessor:
    """Process seminar transcript JSON into searchable chunks."""

    def __init__(self, max_chunk_size: int = 1000, min_merge_size: int = 200):
        self.max_chunk_size = max_chunk_size
        self.min_merge_size = min_merge_size

    def process_seminar(
        self,
        raw_json_path: Path,
        contents_json_path: Optional[Path] = None,
    ) -> List[SeminarChunk]:
        """
        Process a single seminar transcript JSON file into chunks.

        Args:
            raw_json_path: Path to the raw seminar JSON file
            contents_json_path: Optional path to the "C" (contents) version

        Returns:
            List of SeminarChunk objects
        """
        with open(raw_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        code = data.get("catNum", raw_json_path.stem)
        title = data.get("title", "Unknown Seminar")
        content_html = data.get("content", "")

        if not content_html.strip():
            return []

        # Parse section headings from contents version
        section_headings = []
        if contents_json_path and contents_json_path.exists():
            section_headings = self._extract_section_headings(contents_json_path)

        # Parse and clean the HTML content
        soup = BeautifulSoup(content_html, "html.parser")

        # Extract header metadata (date, location) before stripping
        date, location = self._extract_header_metadata(soup)

        # Strip boilerplate
        self._strip_boilerplate(soup)
        self._strip_footer(soup)

        # Parse into speaker turns
        turns = self._parse_speaker_turns(soup)

        # Create chunks from turns
        chunks = self._create_chunks(turns, title, code, section_headings)

        # Attach extracted metadata
        for chunk in chunks:
            chunk._date = date
            chunk._location = location

        return chunks

    def process_for_display(self, raw_json_path: Path):
        """
        Process a transcript for full-text display (not chunked).

        Returns:
            dict with keys: code, title, date, location, turns (list of SpeakerTurn)
        """
        with open(raw_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        code = data.get("catNum", raw_json_path.stem)
        title = data.get("title", "Unknown Seminar")
        content_html = data.get("content", "")

        if not content_html.strip():
            return {"code": code, "title": title, "date": None,
                    "location": None, "turns": []}

        soup = BeautifulSoup(content_html, "html.parser")
        date, location = self._extract_header_metadata(soup)
        self._strip_boilerplate(soup)
        self._strip_footer(soup)

        # Parse into raw speaker turns, preserving paragraph boundaries
        raw_turns = self._parse_speaker_turns_for_display(soup)

        turns = []
        for i, (speaker, paragraphs) in enumerate(raw_turns):
            turns.append(SpeakerTurn(
                speaker=self._normalize_speaker(speaker) if speaker else None,
                paragraphs=paragraphs,
                turn_index=i,
            ))

        return {
            "code": code,
            "title": title,
            "date": date,
            "location": location,
            "turns": turns,
        }

    def _extract_header_metadata(self, soup: BeautifulSoup):
        """Extract date and location from transcript header."""
        date = None
        location = None

        # Look in the first few paragraphs for date/location patterns
        paragraphs = soup.find_all("p", limit=10)
        for p in paragraphs:
            text = p.get_text().strip()
            # Date patterns like "20th March 1979"
            date_match = re.search(
                r'\d{1,2}(?:st|nd|rd|th)?\s+'
                r'(?:January|February|March|April|May|June|July|'
                r'August|September|October|November|December)\s+\d{4}',
                text
            )
            if date_match and not date:
                date = date_match.group(0)

            # Location often follows date or contains known place indicators
            if any(kw in text for kw in [
                "New Zealand", "London", "Padmaloka", "Bethnal Green",
                "Sukhavati", "Glasgow", "Norfolk", "Tuscany", "India",
            ]):
                loc_match = re.search(r'(?:in|at)\s+(.+?)(?:\.|$)', text)
                if loc_match:
                    location = loc_match.group(1).strip()
                elif not location:
                    # Use the whole line if it looks like a location
                    if len(text) < 100 and not any(c.isdigit() for c in text[:5]):
                        location = text

        return date, location

    def _strip_boilerplate(self, soup: BeautifulSoup):
        """Remove known boilerplate intro text."""
        # Find and remove elements containing boilerplate
        for desc in list(soup.find_all()):
            text = desc.get_text().strip()
            if any(text.startswith(bp) for bp in BOILERPLATE_STARTS):
                desc.decompose()

    def _strip_footer(self, soup: BeautifulSoup):
        """Remove footer attribution lines."""
        for p in reversed(soup.find_all("p")):
            text = p.get_text().strip()
            if not text:
                p.decompose()
                continue
            if any(pat.match(text) for pat in FOOTER_PATTERNS):
                p.decompose()
            else:
                # Stop at first non-footer paragraph from the end
                break

    def _parse_speaker_turns(self, soup: BeautifulSoup):
        """Parse HTML into speaker turns.

        Speaker turns are detected by "Name;" or "Name:" at the start of
        paragraph/line text. Uses _extract_lines() so both <p>-based and
        <br>-based transcript formats are handled uniformly.
        """
        lines = self._extract_lines(soup)
        turns = []  # list of (speaker, text) tuples
        current_speaker = None
        current_text = []

        for line in lines:
            if not line.strip():
                continue

            # Try to detect a speaker change
            match = SPEAKER_TURN_RE.match(line)
            if match:
                name = match.group(1).strip()
                # Skip header-like labels and names that are too long
                if (name.upper() not in HEADER_LABELS
                        and len(name) <= MAX_SPEAKER_NAME_LENGTH):
                    # Save previous turn
                    if current_text:
                        turns.append((current_speaker, " ".join(current_text)))
                        current_text = []

                    current_speaker = self._normalize_speaker(name)
                    # Text after the "Name; " or "Name: " prefix
                    remaining = line[match.end():].strip()
                    if remaining:
                        current_text.append(remaining)
                    continue

            # Regular line — strip [N] page markers before appending
            marker = PAGE_MARKER_RE.match(line)
            if marker:
                line = line[marker.end():].strip()
                if not line:
                    continue
            current_text.append(line)

        # Don't forget the last turn
        if current_text:
            turns.append((current_speaker, " ".join(current_text)))

        return turns

    def _parse_speaker_turns_for_display(self, soup: BeautifulSoup):
        """Parse HTML into speaker turns, preserving paragraph boundaries.

        Handles two common transcript formats:
        1. Separate <p> per paragraph, speaker at start: "Name; text"
        2. Single <p> with <br> line breaks, speaker in <b>Name:</b> inline

        Returns list of (speaker, [paragraph1, paragraph2, ...]) tuples.
        """
        # First, extract text lines by splitting on <br> within paragraphs
        lines = self._extract_lines(soup)

        turns = []
        current_speaker = None
        current_paragraphs = []

        for line in lines:
            if not line.strip():
                continue

            # Check for speaker turn pattern
            match = SPEAKER_TURN_RE.match(line)
            if match:
                name = match.group(1).strip()
                if (name.upper() not in HEADER_LABELS
                        and len(name) <= MAX_SPEAKER_NAME_LENGTH):
                    if current_paragraphs:
                        turns.append((current_speaker, current_paragraphs))
                        current_paragraphs = []

                    current_speaker = name
                    remaining = line[match.end():].strip()
                    if remaining:
                        current_paragraphs.append(remaining)
                    continue

            # Strip [N] page markers from non-speaker lines
            marker = PAGE_MARKER_RE.match(line)
            if marker:
                line = line[marker.end():].strip()
                if not line:
                    continue
            current_paragraphs.append(line)

        if current_paragraphs:
            turns.append((current_speaker, current_paragraphs))

        return turns

    def _extract_lines(self, soup: BeautifulSoup) -> List[str]:
        """Extract text lines from HTML, splitting on both <p> and <br> tags."""
        lines = []
        for p in soup.find_all("p"):
            # Replace <br> tags with a sentinel so we can split
            for br in p.find_all("br"):
                br.replace_with("\n")
            text = p.get_text()
            # Split on newlines (from <br> replacements)
            for segment in text.split("\n"):
                segment = segment.strip()
                if segment:
                    lines.append(segment)
        return lines

    def _normalize_speaker(self, name: str) -> str:
        """Normalize speaker names."""
        if name in SANGHARAKSHITA_ALIASES:
            return "Sangharakshita"
        if name.startswith("_"):
            return "Unknown"
        return name

    def _extract_section_headings(self, contents_path: Path) -> List[str]:
        """Extract section headings from the contents version."""
        try:
            with open(contents_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            content = data.get("content", "")
            soup = BeautifulSoup(content, "html.parser")
            headings = []
            for tag in soup.find_all(["h1", "h2", "h3", "h4", "a"]):
                text = tag.get_text().strip()
                if text and len(text) > 3:
                    headings.append(text)
            return headings
        except Exception:
            return []

    def _create_chunks(
        self,
        turns: list,
        title: str,
        code: str,
        section_headings: List[str],
    ) -> List[SeminarChunk]:
        """Create chunks from speaker turns with size management."""
        chunks = []
        current_section = None

        for speaker, text in turns:
            # Check if this turn starts a new section
            for heading in section_headings:
                if heading.lower() in text[:200].lower():
                    current_section = heading
                    break

            if len(text) <= self.max_chunk_size:
                chunks.append(SeminarChunk(
                    text=text,
                    seminar_title=title,
                    seminar_code=code,
                    speaker=speaker,
                    section_heading=current_section,
                ))
            else:
                # Split large turns at sentence boundaries
                sub_chunks = self._split_at_sentences(text)
                for sub in sub_chunks:
                    chunks.append(SeminarChunk(
                        text=sub,
                        seminar_title=title,
                        seminar_code=code,
                        speaker=speaker,
                        section_heading=current_section,
                    ))

        # Merge short consecutive chunks from same speaker
        chunks = self._merge_short_chunks(chunks)

        return chunks

    def _split_at_sentences(self, text: str) -> List[str]:
        """Split text at sentence boundaries, respecting max_chunk_size."""
        # Same regex pattern as EPUBProcessor.split_into_sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]

        result = []
        current = ""
        for sentence in sentences:
            if len(current) + len(sentence) + 1 <= self.max_chunk_size:
                current += sentence + " "
            else:
                if current.strip():
                    result.append(current.strip())
                current = sentence + " "

        if current.strip():
            result.append(current.strip())

        return result

    def _merge_short_chunks(self, chunks: List[SeminarChunk]) -> List[SeminarChunk]:
        """Merge short consecutive chunks from the same speaker."""
        if not chunks:
            return chunks

        merged = [chunks[0]]
        for chunk in chunks[1:]:
            prev = merged[-1]
            if (
                chunk.speaker == prev.speaker
                and len(prev.text) < self.min_merge_size
                and len(prev.text) + len(chunk.text) + 1 <= self.max_chunk_size
            ):
                merged[-1] = SeminarChunk(
                    text=prev.text + " " + chunk.text,
                    seminar_title=prev.seminar_title,
                    seminar_code=prev.seminar_code,
                    speaker=prev.speaker,
                    section_heading=prev.section_heading or chunk.section_heading,
                )
            else:
                merged.append(chunk)

        return merged


def process_seminar_to_langchain(
    raw_json_path: str,
    contents_json_path: Optional[str] = None,
    max_chunk_size: int = 1000,
):
    """
    Process a seminar JSON file and convert to LangChain Document format.

    Args:
        raw_json_path: Path to the raw seminar JSON
        contents_json_path: Optional path to contents version
        max_chunk_size: Maximum chunk size in characters

    Returns:
        List of LangChain Document objects
    """
    from langchain_core.documents import Document

    processor = SeminarProcessor(max_chunk_size=max_chunk_size)
    raw_path = Path(raw_json_path)
    contents_path = Path(contents_json_path) if contents_json_path else None

    chunks = processor.process_seminar(raw_path, contents_path)

    documents = []
    for chunk in chunks:
        metadata = {
            "source": f"freebuddhistaudio.com/texts/read?num={chunk.seminar_code}",
            "seminar_title": chunk.seminar_title,
            "seminar_code": chunk.seminar_code,
            "content_type": "seminar",
        }

        if chunk.speaker:
            metadata["speaker"] = chunk.speaker
        if chunk.section_heading:
            metadata["section_heading"] = chunk.section_heading

        # Attach header metadata if available
        if hasattr(chunk, "_date") and chunk._date:
            metadata["date"] = chunk._date
        if hasattr(chunk, "_location") and chunk._location:
            metadata["location"] = chunk._location

        documents.append(Document(
            page_content=chunk.text,
            metadata=metadata,
        ))

    return documents
