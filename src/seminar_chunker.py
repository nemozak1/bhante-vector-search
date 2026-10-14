"""
Exchange-window chunking for seminar transcripts.

A window is a run of consecutive speaker turns, so a participant's question is
embedded together with Sangharakshita's answer and one-word interjections
("Yes.", "Mm.") never become chunks of their own. Windows close at the start of
a new question once they hold MIN_CLOSE chars, or when they would exceed
TARGET chars; long turns are cut into pieces first.

These parameters were chosen by the October 2026 chunking experiment
(turn-per-chunk vs exchange windows, 60 known-item + 25 topical queries).
"""

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

SANGHARAKSHITA = "Sangharakshita"

TARGET = 1800        # max chars of transcript text per window
MIN_CLOSE = 700      # don't close at a question boundary until the window has this much
PIECE_MAX = 1200     # long turns are cut into pieces of at most this size
BACKCHANNEL = 40     # turns shorter than this never count as a new question
OVERLAP_MAX = 700    # when a window closes on size, repeat its last piece if it's this short

SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")

# (speaker, paragraphs, turn_index) — turn_index is the turn's position in the
# full transcript (seminars.transcript.turns), empty turns included.
Turn = Tuple[Optional[str], List[str], int]


@dataclass
class ExchangeChunk:
    index: int
    turn_start: int
    turn_end: int
    speakers: List[str]
    document: str      # 'Speaker: text' lines, as stored and displayed
    embed_text: str    # header + document, as embedded


def header(title: str, date: Optional[str], location: Optional[str]) -> str:
    bits = [b for b in (date, location) if b]
    return title + (f" ({', '.join(bits)})" if bits else "")


def _split_long(paragraphs: List[str]) -> List[str]:
    """Pack paragraphs into pieces <= PIECE_MAX, splitting oversized paragraphs at sentences."""
    units: List[str] = []
    for p in paragraphs:
        if len(p) <= PIECE_MAX:
            units.append(p)
        else:
            units += [s for s in SENTENCE_RE.split(p) if s.strip()]
    pieces, cur = [], ""
    for u in units:
        if cur and len(cur) + 1 + len(u) > PIECE_MAX:
            pieces.append(cur)
            cur = u
        else:
            cur = f"{cur} {u}".strip()
    if cur:
        pieces.append(cur)
    return pieces


def chunk_exchanges(
    turns: Iterable[Turn],
    title: str,
    date: Optional[str] = None,
    location: Optional[str] = None,
) -> List[ExchangeChunk]:
    pieces = []
    for speaker, paragraphs, turn_index in turns:
        paras = [p for p in paragraphs if p.strip()]
        text = " ".join(paras)
        if not text.strip():
            continue
        subs = [text] if len(text) <= PIECE_MAX * 1.25 else _split_long(paras)
        pieces += [(speaker, s, turn_index) for s in subs]

    def line(piece) -> str:
        speaker, text, _ = piece
        return f"{speaker}: {text}" if speaker else text

    def size(window) -> int:
        return sum(len(line(p)) + 1 for p in window)

    windows, cur = [], []
    for piece in pieces:
        speaker, text, _ = piece
        is_question = speaker not in (SANGHARAKSHITA, None) and len(text) >= BACKCHANNEL
        if cur and is_question and size(cur) >= MIN_CLOSE:
            windows.append(cur)
            cur = []
        elif cur and size(cur) + len(line(piece)) > TARGET:
            windows.append(cur)
            last_text = cur[-1][1]
            cur = [cur[-1]] if BACKCHANNEL <= len(last_text) <= OVERLAP_MAX else []
        cur.append(piece)
    if cur:
        windows.append(cur)

    head = header(title, date, location)
    chunks = []
    for i, w in enumerate(windows):
        document = "\n".join(line(p) for p in w)
        chunks.append(ExchangeChunk(
            index=i,
            turn_start=w[0][2],
            turn_end=w[-1][2],
            speakers=sorted({p[0] for p in w if p[0]}),
            document=document,
            embed_text=f"{head}\n\n{document}",
        ))
    return chunks
