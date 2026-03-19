# Seminar Transcript Review Guide

## Overview

The `data/seminars/cleaned/` directory contains processed versions of ~200 seminar
transcripts from freebuddhistaudio.com. The raw HTML downloads (in `raw/`, gitignored)
have inconsistent markup, OCR errors, and speaker name misspellings. The cleaned JSON
files are the corrected, git-tracked versions that the search system serves.

Every edit to a cleaned file should be a git commit with a descriptive message.

## Directory Layout

```
data/seminars/
  raw/                   ← original FBA downloads (gitignored, never modify)
  cleaned/               ← corrected JSON files (git-tracked)
    SEM048.json
    ...
  review_status.json     ← scan results & review tracking (git-tracked)
  REVIEW.md              ← this file
```

## Cleaned File Format

```json
{
  "code": "SEM048",
  "title": "Advice to the Three Fortunate Women - Unchecked",
  "date": "1980",
  "location": "Padmaloka",
  "turns": [
    {
      "speaker": "Sangharakshita",
      "paragraphs": ["First paragraph of this turn...", "Second paragraph..."]
    },
    {
      "speaker": "Sona",
      "paragraphs": ["Their response..."]
    }
  ]
}
```

- `speaker`: normalized name, or `null` for header/unattributed text
- `paragraphs`: list of plain-text strings (no HTML)
- `date` / `location`: may be `null` if not detected — fill in if known

## Commands

```bash
# Scan all seminars for issues, write review_status.json
python review_seminars.py --scan

# Print summary table sorted by issue count
python review_seminars.py --summary

# Regenerate cleaned file(s) from raw (overwrites — check git diff after)
python review_seminars.py --generate SEM048
python review_seminars.py --generate-all
```

## Review Workflow

### With Claude Code

Ask Claude to review a seminar by code:

> "Review SEM048"

or in batches:

> "Review the next 5 unreviewed seminars with the most issues"

Claude will:
1. Read `review_status.json` to find the seminar and its flagged issues
2. Read the cleaned JSON file
3. Propose edits (speaker name corrections, metadata, merging split turns)
4. You approve/reject each edit via the normal tool approval flow
5. Commit the result — the diff is the audit trail

### Reviewing Manually

1. Open `data/seminars/cleaned/SEM048.json` in your editor
2. Search for suspect speaker names from `review_status.json`
3. Fix and save
4. `git diff` to verify, then commit

---

## Instructions for Claude Code

When asked to review a seminar transcript, follow this process:

### 1. Gather Context

- Read `data/seminars/review_status.json` for the seminar's flagged issues
- Read the cleaned file `data/seminars/cleaned/{CODE}.json`
- If the file is very large (>3000 turns), work section by section

### 2. Fix Speaker Names

This is the most common and highest-value fix. Types of speaker errors:

**Misspellings (OCR artifacts):** The raw transcripts were often typed or OCR'd,
producing garbled names. Fix these by matching to the correct name:
- `Dbammamati` → `Dhammamati`
- `Son a` → `Sona`
- `Fadmavajra` → `Padmavajra`
- `Bthante`, `Rhante`, `Phante`, `Bhanteq` → `Sangharakshita`
- `Kanalasila` → `Kamalasila`
- `Vimalam..`, `Vimalarriitra`, `Vixitalamitra` → `Vimalamitra`

**Sangharakshita aliases:** These should already be normalized by the parser,
but check for variants that slipped through: `S`, `S.`, `Bhante`, `SANGHARAKSHITA`.

**False positive speakers:** Sentence fragments misdetected as speaker names.
These typically appear as a "speaker" whose "paragraphs" are the rest of the sentence.
Fix by merging the false turn back into the previous turn's paragraphs:

```json
// BEFORE (broken):
{"speaker": "Sangharakshita", "paragraphs": ["The precept is"]},
{"speaker": "concerned to combat that", "paragraphs": ["tendency in people."]}

// AFTER (fixed):
{"speaker": "Sangharakshita", "paragraphs": ["The precept is concerned to combat that tendency in people."]}
```

**Abbreviated names:** Single-letter or truncated speakers like `A`, `B`, `KS`, `Dp`
are usually abbreviation artifacts. If you can determine the full name from context
(e.g. the seminar's participant list in the header), expand them. If not, leave them
or set to `null`.

### 3. Fix Metadata

- **date**: Look at the first few turns (often header material with `speaker: null`).
  Dates appear as "1980", "20th March 1979", etc. Also check the seminar title
  for date clues.
- **location**: Same area — look for place names like Padmaloka, Sukhavati,
  Bethnal Green, Il Convento, etc.
- **title**: Usually correct from FBA metadata, but remove " - Unchecked" suffix
  if the transcript has been reviewed.

### 4. Merge Broken Turns

Sometimes a single speaker's text is split across multiple consecutive turns with
the same speaker name. These can be left as-is (they represent paragraph breaks)
unless they're clearly artifacts of parser errors.

However, if consecutive turns have the *same* speaker and the split is clearly
wrong (mid-sentence break), merge them.

### 5. Handle Unattributed Text

Turns with `"speaker": null` at the start of the transcript are usually header
material (title, date, participants list). These are fine to leave as-is.

Turns with `"speaker": null` in the middle of the transcript usually mean the
parser couldn't detect a speaker change. If from context you can determine the
speaker, set it. If not, leave as `null`.

### 6. Update review_status.json

After completing a review, update the seminar's entry in `review_status.json`:

```json
{
  "SEM048": {
    "status": "reviewed",
    ...
  }
}
```

### 7. Commit

Each review should be its own commit with a message describing what was fixed:

```
review SEM048: fix speaker names (Dbammamati→Dhammamati, Son a→Sona), add date/location
```

### Tips

- The `"turns"` array is often 500+ entries. Use search-and-replace patterns
  rather than reading every turn.
- For speaker name fixes, a single `Edit` with `replace_all` is often sufficient.
- Focus on speakers that appear in the issues list first — these are the
  highest-confidence problems.
- Don't try to fix content/text errors (typos within paragraphs) — only fix
  structural issues (speakers, metadata, broken turns).
- When uncertain about a name spelling, leave it rather than guessing wrong.
  The raw file in `data/seminars/raw/` can be consulted for the original HTML
  if you need to check what the source actually says.
