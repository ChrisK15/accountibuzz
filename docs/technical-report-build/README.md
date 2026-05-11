# Technical Report — PDF Build

Source-of-truth markdown lives at `docs/technical-report.md`. This directory
holds the build pipeline that turns it into the styled `docs/technical-report.pdf`
(cover page + table of contents + print-tuned CSS).

The pipeline exists because `pandoc <md> -o <pdf>` produces an ugly
LaTeX-default look. Instead we render through Chrome's print engine and apply a
custom stylesheet.

## Pipeline

```
docs/technical-report.md
        │
        │  pandoc → HTML body fragment
        ▼
   body.html  (intermediate, regeneratable)
        │
        │  build.py → adds cover page, TOC, print CSS
        ▼
   report.html  (intermediate, regeneratable)
        │
        │  Google Chrome --headless --print-to-pdf
        ▼
docs/technical-report.pdf  ← committed
```

## Prerequisites

| Tool | Purpose | Install (macOS) |
|------|---------|-----------------|
| `pandoc` | Markdown → HTML body | `brew install pandoc` |
| Python 3 | Runs `build.py` (stdlib only, no deps) | ships with macOS / `brew install python` |
| Google Chrome | Headless HTML → PDF | `/Applications/Google Chrome.app` |
| `pdftoppm` (optional) | Render preview PNGs of the PDF | `brew install poppler` |

## Build

Run from this directory:

```bash
cd docs/technical-report-build

# 1. Markdown → HTML body fragment
pandoc ../technical-report.md -f markdown -t html5 --no-highlight -o body.html

# 2. Wrap with cover, TOC, and print CSS
python3 build.py

# 3. Render to PDF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu \
  --no-pdf-header-footer --print-to-pdf-no-header \
  --hide-scrollbars --virtual-time-budget=15000 \
  --print-to-pdf=technical-report.pdf \
  "file://$(pwd)/report.html"

# 4. Publish
cp technical-report.pdf ../technical-report.pdf
```

One-liner:

```bash
cd docs/technical-report-build && \
pandoc ../technical-report.md -t html5 --no-highlight -o body.html && \
python3 build.py && \
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf-no-header --hide-scrollbars --virtual-time-budget=15000 \
  --print-to-pdf=../technical-report.pdf \
  "file://$(pwd)/report.html"
```

## Editing

### Content
Edit `docs/technical-report.md`. The build re-derives the table of contents
from `<h2>` / `<h3>` / `<h4>` headings on every run — no manual TOC upkeep.

### Cover page
The cover HTML is the `COVER_HTML` string near the top of `build.py`. Change
course name, authors, version, abstract, and footer there. The cover styles
live under the `/* ---------- Cover page ---------- */` block in the `CSS`
string.

### Page layout (margins, page size, page numbers)
The `@page` rules at the top of the `CSS` string. Letter size, 0.85" side
margins, page-number footer in the bottom-center. The first page (cover)
suppresses the footer via `@page :first`.

### Tables
Two-column "Field / Content" tables get a fixed 1.55" label column via the
`table:has(thead > tr > th:nth-child(2):last-child)` selector. Multi-column
tables keep pandoc's percentage hints. To change the label column width or
the rule, search for `1.55in` in `build.py`.

If you add new tables to the markdown and the column widths look wrong:
- 2-column tables: pandoc's colgroup is auto-stripped (see `_strip_2col_colgroup`).
- 3+ column tables: pandoc derives column widths from the dash count between
  pipes in the separator row. To force a wider column, lengthen its dashes.
  Example: `|----|------------|----|` makes the middle column wider.

### Typography / colors
Search for `Manrope` (body font) and `JetBrains Mono` (code font) — both
loaded from Google Fonts. Brand accents `#FFDE42` (yellow) and `#53CBF3`
(cyan) appear on the cover rule, the abstract bar, and code-block left
borders.

## Verifying the output

```bash
# page count + size
pdfinfo technical-report.pdf | grep -E 'Pages|Page size'

# render previews of specific pages for visual check
pdftoppm -png -r 100 -f 1 -l 3 technical-report.pdf preview
open preview-*.png
```

## Files

| File | Status | Purpose |
|------|--------|---------|
| `build.py` | committed | Generator: assembles cover + TOC + body + CSS |
| `README.md` | committed | This file |
| `body.html` | gitignored | Intermediate, regenerated each build |
| `report.html` | gitignored | Intermediate, regenerated each build |
| `technical-report.pdf` | gitignored | Local build artifact; the published copy is `../technical-report.pdf` |
| `preview-*.png` | gitignored | Optional pdftoppm previews |
