# Seminar Transcript Review Guide

## Overview

The `data/seminars/cleaned/` directory contains processed versions of ~200 seminar
transcripts from freebuddhistaudio.com. The raw HTML downloads (in `raw/`, gitignored)
have inconsistent markup, OCR errors, and speaker name misspellings. The cleaned JSON
files are the corrected, git-tracked versions that the search system serves.

Every edit to a cleaned file should be a git commit with a descriptive message.
When Claude does the review, Claude stages the changes and the human commits
them after reviewing the diff (see "Instructions for Claude Code" below).

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
3. Do an **issues pass** (fix everything flagged) and then a **full pass** over
   every turn to catch problems the scanner missed
4. Propose edits (speaker name corrections, metadata, merging split turns)
5. You approve/reject each edit via the normal tool approval flow
6. **Stage** the result with `git add`, then stop — you inspect the staged diff
   and commit yourself. The diff is the audit trail.

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

### 1a. Two-pass review

The flagged-issues list is a starting point, not the whole job. Always do a second
pass over the full transcript to catch problems the scanner missed. The scanner is
heuristic — it will miss real speaker changes buried inside another speaker's
paragraphs, mid-sentence splits that happen to land on a plausible-sounding word,
unflagged misspellings that don't trip the suspect-speaker rule, and so on.

Recommended order:

1. **Issues pass** — fix everything in `review_status.json`'s `issues` list and
   the metadata fields (`date`, `location`, `title`).
2. **Full pass** — walk every turn (or, for large files, every section). Read enough
   of each turn to confirm the speaker attribution makes sense in context. Cross-
   check the speaker frequency table against the participant list in the header.
   Look for:
   - Plausible-looking words appearing once as speakers (often false positives the
     scanner didn't flag, e.g. `paradoxical`, `Two`, `Four`).
   - Real speakers buried inside another's mega-turn (the parser missed the cue).
   - Garbled names not matched by the misspelling heuristics.
   - Mid-sentence splits where one turn ends mid-clause and the next begins
     lowercase or with a continuation word.

Reading every paragraph for OCR/typo content errors is still out of scope — the
goal of the full pass is structural correctness (speakers, turn boundaries,
metadata), not prose-level proofreading.

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
- **title**: Usually correct from FBA metadata. **Leave the " - Unchecked" suffix
  in place** even after a structural review. "Unchecked" specifically means the
  transcript has never been verified against the original audio recording —
  which is a different (and stricter) bar than the structural cleanup this
  workflow performs (speakers, metadata, false-positive merges, OCR variants).
  The suffix only goes when a human has actually compared the prose against
  the recording.

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

### 7. Stage, don't commit

Stage the changes (`git add data/seminars/cleaned/{CODE}.json data/seminars/review_status.json`)
but **do not commit** — the human reviewer will inspect the staged diff and commit
themselves. This keeps a human in the loop on the audit trail and lets the
reviewer batch or amend before recording the change.

When proposing a commit message for the human to use, follow this style:

```
review SEM048: fix speaker names (Dbammamati→Dhammamati, Son a→Sona), add date/location
```

### Tips

- The `"turns"` array is often 500+ entries. Use search-and-replace patterns
  for the issues pass; for the full pass, iterate programmatically (e.g. a Python
  loop printing `[i] speaker: first 200 chars` for every turn) rather than reading
  the file front-to-back.
- For speaker name fixes, a single `Edit` with `replace_all` is often sufficient.
- Focus on speakers that appear in the issues list first — these are the
  highest-confidence problems — but always run the full second pass before
  staging.
- Don't try to fix content/text errors (typos within paragraphs) — only fix
  structural issues (speakers, metadata, broken turns).
- When uncertain about a name spelling, leave it rather than guessing wrong.
  The raw file in `data/seminars/raw/` can be consulted for the original HTML
  if you need to check what the source actually says.
- Stage the changes for human review; do not commit.
