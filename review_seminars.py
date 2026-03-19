#!/usr/bin/env python3
"""
Seminar transcript review system.

Analyzes raw seminar transcripts for quality issues, generates cleaned JSON
files for review, and tracks review status.

Usage:
    python review_seminars.py --scan              # analyze all, write review_status.json
    python review_seminars.py --summary           # print summary table
    python review_seminars.py --generate SEM048   # generate one cleaned file
    python review_seminars.py --generate-all      # generate all cleaned files
"""

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List, Optional

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.seminar_processor import (
    HEADER_LABELS,
    MAX_SPEAKER_NAME_LENGTH,
    SPEAKER_TURN_RE,
    SeminarProcessor,
)

RAW_DIR = PROJECT_ROOT / "data" / "seminars" / "raw"
CLEANED_DIR = PROJECT_ROOT / "data" / "seminars" / "cleaned"
STATUS_FILE = PROJECT_ROOT / "data" / "seminars" / "review_status.json"


def get_raw_seminar_codes() -> List[str]:
    """Get sorted list of seminar codes from raw directory (excluding C variants)."""
    codes = []
    for f in RAW_DIR.glob("*.json"):
        name = f.stem
        # Skip contents versions (e.g. SEM001C) and non-seminar files
        if name.endswith("C"):
            continue
        if not re.match(r"^SEM\d+", name) and not name.isdigit():
            continue
        codes.append(name)
    return sorted(codes)


@dataclass
class ScanResult:
    """Result of scanning a single seminar for issues."""
    code: str
    title: str
    format_type: str  # "p-based", "br-based", "mixed"
    turn_count: int
    total_paragraphs: int
    unattributed_pct: float
    issues: List[str]
    has_date: bool
    has_location: bool


def detect_format_type(raw_json_path: Path) -> str:
    """Detect whether transcript uses <p>, <br>, or mixed formatting."""
    with open(raw_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    content = data.get("content", "")
    if not content:
        return "empty"

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(content, "html.parser")

    p_count = len(soup.find_all("p"))
    br_count = len(soup.find_all("br"))

    if br_count == 0:
        return "p-based"
    elif p_count <= 3:  # basically one big <p> with <br> breaks
        return "br-based"
    else:
        return "mixed"


def scan_seminar(raw_json_path: Path) -> ScanResult:
    """Analyze a single seminar for quality issues."""
    with open(raw_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    code = data.get("catNum", raw_json_path.stem)
    title = data.get("title", "Unknown")

    format_type = detect_format_type(raw_json_path)

    processor = SeminarProcessor()
    result = processor.process_for_display(raw_json_path)

    turns = result["turns"]
    issues = []

    # Count speakers and detect suspects
    speaker_counts = Counter()
    total_paragraphs = 0
    unattributed_paragraphs = 0

    for turn in turns:
        speaker = turn.speaker
        n_paras = len(turn.paragraphs)
        total_paragraphs += n_paras

        if speaker is None:
            unattributed_paragraphs += n_paras
        else:
            speaker_counts[speaker] += 1

    # Suspect speakers: single occurrence, very long, or all-caps (not Sangharakshita)
    for speaker, count in speaker_counts.items():
        if speaker in ("Sangharakshita", "Unknown"):
            continue
        if count == 1:
            issues.append(f"suspect_speaker:{speaker}({count})")
        elif len(speaker) > 25:
            issues.append(f"long_speaker_name:{speaker}")
        elif speaker.isupper() and len(speaker) > 2:
            issues.append(f"all_caps_speaker:{speaker}")

    # Metadata gaps
    if not result.get("date"):
        issues.append("missing_date")
    if not result.get("location"):
        issues.append("missing_location")

    unattributed_pct = (
        round(unattributed_paragraphs / total_paragraphs * 100, 1)
        if total_paragraphs > 0
        else 0.0
    )
    if unattributed_pct > 10:
        issues.append(f"high_unattributed:{unattributed_pct}%")

    return ScanResult(
        code=code,
        title=title,
        format_type=format_type,
        turn_count=len(turns),
        total_paragraphs=total_paragraphs,
        unattributed_pct=unattributed_pct,
        issues=issues,
        has_date=result.get("date") is not None,
        has_location=result.get("location") is not None,
    )


def cmd_scan():
    """Scan all seminars and write review_status.json."""
    codes = get_raw_seminar_codes()
    print(f"Scanning {len(codes)} seminars...\n")

    # Load existing status to preserve review states
    existing_status = {}
    if STATUS_FILE.exists():
        with open(STATUS_FILE, "r") as f:
            existing_status = json.load(f)

    status = {}
    error_count = 0

    for code in codes:
        raw_path = RAW_DIR / f"{code}.json"
        try:
            result = scan_seminar(raw_path)
            # Preserve existing review status
            prev = existing_status.get(code, {})
            status[code] = {
                "status": prev.get("status", "unreviewed"),
                "title": result.title,
                "format_type": result.format_type,
                "turn_count": result.turn_count,
                "total_paragraphs": result.total_paragraphs,
                "unattributed_pct": result.unattributed_pct,
                "issues": result.issues,
                "has_date": result.has_date,
                "has_location": result.has_location,
            }
        except Exception as e:
            print(f"  ERROR scanning {code}: {e}")
            error_count += 1
            status[code] = {
                "status": "error",
                "issues": [f"scan_error:{e}"],
            }

    # Write status file
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)

    # Print summary
    total = len(status)
    with_issues = sum(1 for s in status.values() if s.get("issues"))
    reviewed = sum(1 for s in status.values() if s.get("status") == "reviewed")

    print(f"Scan complete. Wrote {STATUS_FILE}")
    print(f"Total: {total} seminars, {with_issues} with issues, "
          f"{reviewed} reviewed, {error_count} errors")

    # Print the summary table too
    _print_summary_table(status)


def cmd_summary():
    """Print summary table from review_status.json."""
    if not STATUS_FILE.exists():
        print("No review_status.json found. Run --scan first.")
        sys.exit(1)

    with open(STATUS_FILE, "r") as f:
        status = json.load(f)

    _print_summary_table(status)


def _print_summary_table(status: dict):
    """Print a formatted summary table."""
    print()
    print(f"{'Code':<12} {'Format':<10} {'Turns':>6} {'Issues':>7} {'Status':<12}")
    print("-" * 55)

    # Sort by number of issues (descending), then code
    entries = sorted(
        status.items(),
        key=lambda kv: (-len(kv[1].get("issues", [])), kv[0]),
    )

    for code, info in entries:
        fmt = info.get("format_type", "?")
        turns = info.get("turn_count", "?")
        n_issues = len(info.get("issues", []))
        st = info.get("status", "?")
        print(f"{code:<12} {fmt:<10} {turns:>6} {n_issues:>7} {st:<12}")

    total = len(status)
    with_issues = sum(1 for s in status.values() if s.get("issues"))
    reviewed = sum(1 for s in status.values() if s.get("status") == "reviewed")
    print("-" * 55)
    print(f"Total: {total} seminars, {with_issues} with issues, {reviewed} reviewed")


def generate_cleaned(code: str) -> Optional[Path]:
    """Generate a cleaned JSON file for a single seminar."""
    raw_path = RAW_DIR / f"{code}.json"
    if not raw_path.exists():
        print(f"  Raw file not found: {raw_path}")
        return None

    processor = SeminarProcessor()
    result = processor.process_for_display(raw_path)

    # Convert SpeakerTurn dataclasses to plain dicts
    cleaned = {
        "code": result["code"],
        "title": result["title"],
        "date": result.get("date"),
        "location": result.get("location"),
        "turns": [
            {
                "speaker": t.speaker,
                "paragraphs": t.paragraphs,
            }
            for t in result["turns"]
        ],
    }

    CLEANED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = CLEANED_DIR / f"{code}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)

    return output_path


def cmd_generate(codes: List[str]):
    """Generate cleaned files for specified seminars."""
    for code in codes:
        path = generate_cleaned(code)
        if path:
            print(f"  Wrote {path}")
        else:
            print(f"  Skipped {code}")


def cmd_generate_all():
    """Generate cleaned files for all seminars."""
    codes = get_raw_seminar_codes()
    print(f"Generating cleaned files for {len(codes)} seminars...")
    success = 0
    errors = 0
    for code in codes:
        try:
            path = generate_cleaned(code)
            if path:
                success += 1
        except Exception as e:
            print(f"  ERROR generating {code}: {e}")
            errors += 1
    print(f"Done. {success} generated, {errors} errors.")


def main():
    parser = argparse.ArgumentParser(
        description="Seminar transcript review system"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--scan", action="store_true",
                       help="Scan all seminars, write review_status.json")
    group.add_argument("--summary", action="store_true",
                       help="Print summary table from review_status.json")
    group.add_argument("--generate", nargs="+", metavar="CODE",
                       help="Generate cleaned JSON for specific seminar(s)")
    group.add_argument("--generate-all", action="store_true",
                       help="Generate cleaned JSON for all seminars")

    args = parser.parse_args()

    if args.scan:
        cmd_scan()
    elif args.summary:
        cmd_summary()
    elif args.generate:
        cmd_generate(args.generate)
    elif args.generate_all:
        cmd_generate_all()


if __name__ == "__main__":
    main()
