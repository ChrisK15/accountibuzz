#!/usr/bin/env python3
"""Build a styled HTML technical report with cover + TOC from a pandoc-generated body fragment.

Reads ./body.html (produced by pandoc from ../technical-report.md), wraps it with
a cover page + TOC + print CSS, and writes ./report.html. See README.md.
"""
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BODY_HTML = (ROOT / "body.html").read_text()
OUT = ROOT / "report.html"

# Pandoc emits <colgroup><col style="width: NN%"></colgroup> based on the dash
# count in the markdown table separator. For 2-column "Field/Content" tables
# those widths are wildly misleading (43% / 56% for short labels), so strip the
# colgroup ONLY from 2-column tables and let CSS size them. Multi-column tables
# keep pandoc's hints because dropping them auto-shrinks the first column too
# aggressively (e.g. ID cells like "O-01" wrap on the dash).
def _strip_2col_colgroup(match: "re.Match[str]") -> str:
    table = match.group(0)
    n_cols = len(re.findall(r"<col\b", table))
    if n_cols == 2:
        return re.sub(r"<colgroup>.*?</colgroup>", "", table, flags=re.DOTALL)
    return table

BODY_HTML = re.sub(r"<table>.*?</table>", _strip_2col_colgroup, BODY_HTML, flags=re.DOTALL)

# --- 1. Extract headings (h2/h3/h4) for TOC ----------------------------------
heading_re = re.compile(
    r'<(h[234])\s+id="([^"]+)">(.+?)</\1>',
    re.DOTALL,
)
toc_entries = []
for m in heading_re.finditer(BODY_HTML):
    tag, hid, raw = m.group(1), m.group(2), m.group(3)
    text = re.sub(r"\s+", " ", unescape(raw)).strip()
    level = int(tag[1])  # 2, 3, 4
    toc_entries.append((level, hid, text))

# --- 2. Build TOC HTML --------------------------------------------------------
toc_lines = ['<nav class="toc">', '<h1 class="toc-title">Table of Contents</h1>', '<ol class="toc-list">']
prev_level = 1
for level, hid, text in toc_entries:
    cls = f"toc-l{level}"
    toc_lines.append(
        f'  <li class="{cls}"><a href="#{hid}"><span class="toc-text">{text}</span><span class="toc-leader"></span><span class="toc-page"></span></a></li>'
    )
toc_lines.append("</ol>")
toc_lines.append("</nav>")
TOC_HTML = "\n".join(toc_lines)

# --- 3. Cover page -----------------------------------------------------------
COVER_HTML = """
<section class="cover">
  <div class="cover-rule"></div>
  <div class="cover-eyebrow">COMP 586 &middot; Software Engineering Management</div>
  <h1 class="cover-title">Accountibuzz</h1>
  <div class="cover-subtitle">Technical Report</div>
  <p class="cover-tagline">Vision and Scope &middot; Use Cases &middot; Software Requirements Specification</p>

  <p class="cover-abstract">
    A small-group accountability app for iOS and Android. Members submit daily photo or video proof
    of a personal commitment; a single group admin verifies each submission; points, streaks, and a
    live leaderboard turn verified work into visible social signal. This document captures the
    product vision, the canonical use cases, and the full software requirements specification for
    the v1.0 MVP.
  </p>

  <table class="cover-meta">
    <tr><th>Prepared by</th><td>Chris Kelamyan &middot; Timothy Do</td></tr>
    <tr><th>Document version</th><td>v1.0 &mdash; MVP scope</td></tr>
    <tr><th>Last updated</th><td>May 8, 2026</td></tr>
    <tr><th>Repository</th><td><code>accountibuzz</code></td></tr>
    <tr><th>Source</th><td><code>docs/technical-report.md</code></td></tr>
  </table>

  <div class="cover-footer">
    <span>Accountibuzz &middot; Technical Report</span>
    <span>May 2026</span>
  </div>
</section>
"""

# --- 4. Full HTML document ---------------------------------------------------
CSS = r"""
@page {
  size: Letter;
  margin: 0.85in 0.85in 1in 0.85in;
  @bottom-center {
    content: counter(page);
    font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9pt;
    color: #6b6b6b;
  }
}
@page :first {
  @bottom-center { content: ""; }
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: 'Manrope', 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1d1d1f;
  -webkit-font-smoothing: antialiased;
}

/* ---------- Cover page ---------- */
.cover {
  page-break-after: always;
  break-after: page;
  padding-top: 0.4in;
}
.cover-rule {
  height: 10px;
  background: linear-gradient(90deg, #FFDE42 0%, #FFDE42 65%, #53CBF3 65%, #53CBF3 100%);
  margin-bottom: 0.55in;
  border-radius: 2px;
}
.cover-eyebrow {
  font-size: 10pt;
  letter-spacing: 0.22em;
  font-weight: 700;
  color: #5b5b60;
  text-transform: uppercase;
  margin-bottom: 0.35in;
}
.cover-title {
  font-size: 64pt;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0 0 0.08in 0;
  color: #111;
  border: 0;
  padding: 0;
}
.cover-subtitle {
  font-size: 26pt;
  font-weight: 500;
  margin: 0 0 0.18in 0;
  color: #2a2a2e;
}
.cover-tagline {
  font-size: 12pt;
  color: #4a4a50;
  margin: 0 0 0.55in 0;
  font-weight: 500;
}
.cover-abstract {
  font-size: 10.5pt;
  line-height: 1.6;
  color: #2c2c30;
  max-width: 6.2in;
  border-left: 3px solid #FFDE42;
  padding: 4px 0 4px 14px;
  margin: 0 0 0.45in 0;
}
table.cover-meta {
  width: 100%;
  max-width: 5.5in;
  border-collapse: collapse;
  margin: 0 0 0.55in 0;
  font-size: 10.5pt;
}
table.cover-meta th,
table.cover-meta td {
  text-align: left;
  padding: 7px 12px;
  border: 0;
  border-bottom: 1px solid #d6d2c5;
  background: transparent;
  vertical-align: middle;
  font-size: 10.5pt;
}
table.cover-meta tbody tr:nth-child(even) td,
table.cover-meta tr:nth-child(even) td {
  background: transparent;
}
table.cover-meta th {
  width: 1.8in;
  color: #6b6b6b;
  font-weight: 500;
  font-family: inherit;
  letter-spacing: 0;
  text-transform: none;
}
table.cover-meta td {
  color: #1d1d1f;
  font-weight: 600;
}
table.cover-meta code {
  background: transparent;
  border: 0;
  padding: 0;
  color: inherit;
  font-size: 10pt;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-weight: 500;
}
.cover-footer {
  display: flex;
  justify-content: space-between;
  font-size: 9pt;
  color: #6b6b6b;
  letter-spacing: 0.04em;
  border-top: 1px solid #d6d2c5;
  padding-top: 10px;
  margin-top: 0.4in;
}

/* ---------- TOC ---------- */
.toc {
  page-break-after: always;
}
.toc-title {
  font-size: 26pt;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0 0 0.35in 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #1d1d1f;
}
.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: toc-counter;
}
.toc-list li {
  margin: 0;
  padding: 0;
}
.toc-list a {
  display: flex;
  align-items: baseline;
  text-decoration: none;
  color: inherit;
  padding: 4px 0;
}
.toc-text {
  flex-shrink: 0;
}
.toc-leader {
  flex: 1;
  border-bottom: 1px dotted #b9b9bd;
  margin: 0 6px;
  position: relative;
  top: -3px;
}
.toc-page::before {
  content: target-counter(attr(href), page);
  font-variant-numeric: tabular-nums;
  color: #6b6b6b;
  font-size: 9.5pt;
}
.toc-l2 a {
  font-weight: 800;
  font-size: 11.5pt;
  margin-top: 10px;
  color: #111;
}
.toc-l3 a {
  font-weight: 600;
  font-size: 10.5pt;
  padding-left: 18px;
  color: #2a2a2e;
}
.toc-l4 a {
  font-weight: 500;
  font-size: 10pt;
  padding-left: 36px;
  color: #4a4a50;
}

/* ---------- Body content ---------- */
.report-body {
  /* counter resets are handled by browser default */
}

h2 {
  font-size: 22pt;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0.55in 0 0.18in 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #1d1d1f;
  page-break-before: always;
  page-break-after: avoid;
}
.report-body > h2:first-of-type {
  page-break-before: auto;
}
h3 {
  font-size: 15pt;
  font-weight: 800;
  letter-spacing: -0.005em;
  margin: 0.32in 0 0.1in 0;
  color: #111;
  page-break-after: avoid;
}
h4 {
  font-size: 12pt;
  font-weight: 700;
  margin: 0.22in 0 0.06in 0;
  color: #111;
  page-break-after: avoid;
}
p {
  margin: 0 0 9pt 0;
  text-align: left;
  hyphens: auto;
  orphans: 3;
  widows: 3;
}
ul, ol { margin: 0 0 10pt 0; padding-left: 1.4em; }
li { margin: 2pt 0; }
li > p { margin: 0; }
strong { font-weight: 700; color: #111; }
em { font-style: italic; }

a {
  color: #0066c2;
  text-decoration: none;
}
a:hover { text-decoration: underline; }

code {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: #f3efe6;
  border: 1px solid #e3ddc9;
  padding: 1px 5px;
  border-radius: 4px;
  color: #5a3a00;
  white-space: nowrap;
}
pre {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
  font-size: 8.5pt;
  background: #f7f5ef;
  border: 1px solid #e3ddc9;
  border-left: 3px solid #FFDE42;
  border-radius: 4px;
  padding: 10px 14px;
  margin: 8pt 0 12pt 0;
  line-height: 1.45;
  white-space: pre;
  overflow-x: auto;
  page-break-inside: avoid;
}
pre code {
  background: transparent;
  border: 0;
  padding: 0;
  color: #1d1d1f;
  white-space: pre;
}
blockquote {
  margin: 0 0 12pt 0;
  padding: 6pt 14px;
  border-left: 3px solid #FFDE42;
  background: #fdf9e8;
  color: #2c2c30;
  font-style: italic;
}
hr {
  border: 0;
  border-top: 1px solid #d6d2c5;
  margin: 0.3in 0;
}

/* ---------- Tables ---------- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 14pt 0;
  font-size: 9.5pt;
  page-break-inside: auto;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th {
  background: #1d1d1f;
  color: #faf8f3;
  font-weight: 700;
  text-align: left;
  padding: 7px 9px;
  border: 1px solid #1d1d1f;
  letter-spacing: 0.01em;
  font-size: 9pt;
}
td {
  border: 1px solid #d6d2c5;
  padding: 6px 9px;
  vertical-align: top;
  background: #fff;
}
tbody tr:nth-child(even) td { background: #faf8f3; }

/* 2-column key/value tables (use-case fields, simple lookups, etc.): narrow the
   label column so the value column gets the page width it deserves. */
table:has(thead > tr > th:nth-child(2):last-child) th:first-child,
table:has(thead > tr > th:nth-child(2):last-child) td:first-child {
  width: 1.55in;
  white-space: normal;
  word-break: break-word;
}

/* Trailing italic footer in source */
.report-body em + br + em,
.report-body p:last-of-type em {
  color: #6b6b6b;
  font-size: 9pt;
}

/* Avoid awkward solitary headings */
h3 + p, h4 + p, h2 + p { page-break-before: avoid; }
"""

# Embed Manrope from Google Fonts (works offline only if network at print time;
# Chrome's --headless does load remote fonts. We add system fallbacks.)
FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com">' \
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
            '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">'

HTML = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Accountibuzz — Technical Report</title>
{FONT_LINK}
<style>{CSS}</style>
</head>
<body>
{COVER_HTML}
{TOC_HTML}
<main class="report-body">
{BODY_HTML}
</main>
</body>
</html>
"""

OUT.write_text(HTML)
print(f"Wrote {OUT} ({len(HTML):,} bytes, {len(toc_entries)} TOC entries)")
