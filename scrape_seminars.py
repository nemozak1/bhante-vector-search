#!/usr/bin/env python3
"""
Seminar Scraper CLI

Discovers and downloads Sangharakshita's seminar transcripts from
freebuddhistaudio.com.

Usage:
    python scrape_seminars.py                          # full discovery + download
    python scrape_seminars.py --retry-failed           # retry failures only
    python scrape_seminars.py --codes SEM050,SEM052P1  # specific codes
    python scrape_seminars.py --discover-only          # just build catalog
"""

import argparse
from pathlib import Path

from src.seminar_scraper import SeminarScraper, DEFAULT_DATA_DIR


def main():
    parser = argparse.ArgumentParser(
        description="Scrape seminar transcripts from freebuddhistaudio.com"
    )
    parser.add_argument(
        "--discover-only",
        action="store_true",
        help="Only build the catalog, don't download transcripts",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Re-attempt only previously failed downloads",
    )
    parser.add_argument(
        "--codes",
        type=str,
        default=None,
        help="Comma-separated list of seminar codes to download (e.g. SEM050,SEM051)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between requests (default: 1.0)",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(DEFAULT_DATA_DIR),
        help=f"Data directory (default: {DEFAULT_DATA_DIR})",
    )

    args = parser.parse_args()
    data_dir = Path(args.data_dir)

    with SeminarScraper(data_dir=data_dir, delay=args.delay) as scraper:
        # Always discover first if no catalog exists or not retrying specific codes
        catalog_path = data_dir / "catalog.json"
        if not catalog_path.exists() or (not args.retry_failed and not args.codes):
            scraper.discover()

        if args.discover_only:
            return

        codes = args.codes.split(",") if args.codes else None
        scraper.download(codes=codes, retry_failed=args.retry_failed)


if __name__ == "__main__":
    main()
