"""
Seminar transcript scraper for freebuddhistaudio.com.

Discovers and downloads Sangharakshita's seminar transcripts from the
FBA catalog API and individual text pages.
"""

import json
import re
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import httpx


BASE_URL = "https://www.freebuddhistaudio.com"
CATALOG_API = f"{BASE_URL}/api/v1/collections/sangharakshita_seminars"
DEFAULT_DATA_DIR = Path("data/seminars")


@dataclass
class CatalogEntry:
    """A single seminar entry from the catalog."""
    url: str
    title: str
    speaker: str
    code: str
    has_contents: bool = False
    status: str = "pending"  # pending / downloaded / failed / empty


@dataclass
class DownloadAttempt:
    """Record of a download attempt."""
    code: str
    timestamp: str
    success: bool
    error: Optional[str] = None


class SeminarScraper:
    """Scrapes seminar transcripts from freebuddhistaudio.com."""

    def __init__(self, data_dir: Path = DEFAULT_DATA_DIR, delay: float = 1.0):
        self.data_dir = data_dir
        self.raw_dir = data_dir / "raw"
        self.delay = delay
        self.client = httpx.Client(timeout=30.0, follow_redirects=True)
        self.catalog: List[CatalogEntry] = []
        self.download_log: List[DownloadAttempt] = []

        # Ensure directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    # ── Discovery ──────────────────────────────────────────────────────

    def discover(self, max_pages: int = 400) -> List[CatalogEntry]:
        """Paginate through the catalog API and build the catalog.

        The FBA API returns 1 item per page (page_size is fixed at 1),
        so we paginate through all pages up to total_items.
        """
        print("Discovering seminars from catalog API...")
        entries = []
        seen_codes = set()
        total_items = None

        page_num = 0
        while True:
            page_num += 1
            if page_num > max_pages:
                break

            url = f"{CATALOG_API}?t=text&page={page_num}"

            # Print progress periodically
            if page_num == 1 or page_num % 50 == 0:
                print(f"  Fetching page {page_num}...")

            try:
                resp = self.client.get(url)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                print(f"  Error fetching page {page_num}: {e}")
                break

            # Response is nested under "collection"
            collection = data.get("collection", data)
            if total_items is None:
                total_items = collection.get("total_items", 0)
                print(f"  Total items in catalog: {total_items}")

            items = collection.get("items", [])
            if not items:
                print(f"  No more items on page {page_num}, stopping.")
                break

            for item in items:
                item_url = item.get("url", "")
                title = item.get("title", "")
                speaker = item.get("speaker", item.get("author", ""))

                # Parse seminar code from URL num= param
                # Codes can be numeric ("151") or prefixed ("SEM048")
                code_match = re.search(r'num=([A-Za-z0-9]+)', item_url)
                if not code_match:
                    continue
                code = code_match.group(1)

                # Skip "Contents" entries (codes ending in C)
                if code.endswith("C"):
                    continue

                # Deduplicate
                if code in seen_codes:
                    continue
                seen_codes.add(code)

                entries.append(CatalogEntry(
                    url=item_url,
                    title=title,
                    speaker=speaker,
                    code=code,
                ))

            # Stop if we've fetched all pages
            if total_items and page_num >= total_items:
                break

            time.sleep(self.delay)

        self.catalog = entries
        print(f"Discovered {len(entries)} seminar entries.")
        self._save_catalog()
        return entries

    # ── Download ───────────────────────────────────────────────────────

    def download(
        self,
        codes: Optional[List[str]] = None,
        retry_failed: bool = False,
    ):
        """Download transcript data for catalog entries."""
        self._load_catalog()
        self._load_download_log()

        if not self.catalog:
            print("No catalog loaded. Run discover() first.")
            return

        # Filter entries
        if codes:
            entries = [e for e in self.catalog if e.code in codes]
        elif retry_failed:
            failed_codes = {
                a.code for a in self.download_log if not a.success
            }
            entries = [e for e in self.catalog if e.code in failed_codes]
        else:
            # Download all that haven't been downloaded yet
            already_downloaded = {
                a.code for a in self.download_log if a.success
            }
            entries = [
                e for e in self.catalog if e.code not in already_downloaded
            ]

        print(f"Downloading {len(entries)} transcripts...")

        for i, entry in enumerate(entries, 1):
            print(f"  [{i}/{len(entries)}] {entry.code}: {entry.title[:60]}...")
            self._download_one(entry)
            if i < len(entries):
                time.sleep(self.delay)

        self._save_catalog()
        self._save_download_log()
        self._print_summary()

    def _download_one(self, entry: CatalogEntry):
        """Download a single seminar transcript."""
        timestamp = datetime.now().isoformat()

        try:
            # Fetch main transcript page
            page_url = f"{BASE_URL}/texts/read?num={entry.code}"
            resp = self.client.get(page_url)
            resp.raise_for_status()

            # Extract __FBA__.text JSON from the page
            text_data = self._extract_fba_text(resp.text)
            if not text_data:
                entry.status = "empty"
                self.download_log.append(DownloadAttempt(
                    code=entry.code, timestamp=timestamp,
                    success=False, error="Could not extract __FBA__.text"
                ))
                return

            content = text_data.get("content", "")
            if not content or not content.strip():
                entry.status = "empty"
                self.download_log.append(DownloadAttempt(
                    code=entry.code, timestamp=timestamp,
                    success=False, error="Empty content field"
                ))
                return

            # Save raw JSON
            out_path = self.raw_dir / f"{entry.code}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(text_data, f, ensure_ascii=False, indent=2)

            # Try to fetch contents version
            try:
                contents_url = f"{BASE_URL}/texts/read?num={entry.code}C"
                cresp = self.client.get(contents_url)
                if cresp.status_code == 200:
                    contents_data = self._extract_fba_text(cresp.text)
                    if contents_data:
                        cout_path = self.raw_dir / f"{entry.code}C.json"
                        with open(cout_path, "w", encoding="utf-8") as f:
                            json.dump(contents_data, f, ensure_ascii=False, indent=2)
                        entry.has_contents = True
            except Exception:
                pass  # Contents version is optional

            entry.status = "downloaded"
            self.download_log.append(DownloadAttempt(
                code=entry.code, timestamp=timestamp, success=True
            ))

        except Exception as e:
            entry.status = "failed"
            self.download_log.append(DownloadAttempt(
                code=entry.code, timestamp=timestamp,
                success=False, error=str(e)
            ))
            print(f"    Failed: {e}")

    def _extract_fba_text(self, html: str) -> Optional[dict]:
        """Extract the document.__FBA__.text JSON object from page HTML."""
        marker = "document.__FBA__.text = "
        idx = html.find(marker)
        if idx < 0:
            return None
        try:
            brace_start = html.index("{", idx)
            decoder = json.JSONDecoder()
            obj, _ = decoder.raw_decode(html, brace_start)
            return obj
        except (ValueError, json.JSONDecodeError):
            return None

    # ── Persistence ────────────────────────────────────────────────────

    def _save_catalog(self):
        path = self.data_dir / "catalog.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump([asdict(e) for e in self.catalog], f, indent=2)

    def _load_catalog(self):
        path = self.data_dir / "catalog.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.catalog = [CatalogEntry(**e) for e in data]

    def _save_download_log(self):
        path = self.data_dir / "download_log.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump([asdict(a) for a in self.download_log], f, indent=2)

    def _load_download_log(self):
        path = self.data_dir / "download_log.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.download_log = [DownloadAttempt(**a) for a in data]

    def _print_summary(self):
        statuses = {}
        for entry in self.catalog:
            statuses[entry.status] = statuses.get(entry.status, 0) + 1
        print(f"\nDownload summary:")
        for status, count in sorted(statuses.items()):
            print(f"  {status}: {count}")
