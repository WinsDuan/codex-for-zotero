---
name: research-pdf-reader
description: Read original paper PDFs in Research Bridge for Zotero, including full-paper text and figures, using its native PDF tools and measured page coverage.
---

# Read paper PDFs

This skill runs inside Research Bridge for Zotero. Its `research_pdf_*` tools are supplied by the host. Use the original PDF sources listed in the current turn, with physical page numbers starting at 1.

## Questions about a paper or figure

- Start with `research_pdf_list` to get source ids, total pages and outline.
- Use `research_pdf_search` to locate relevant passages or figure captions. Search results alone do not show a figure.
- Call `research_pdf_read` with `viewImages=true` for figures, tables, scanned pages or page layout. Read nearby text as needed. A call accepts up to 3 pages.
- Cite `[来源 N，PDF 第 X 页]`, distinguishing the physical page from its printed page label.

## Full-paper reading requests

When the user asks to read the complete paper or verify all figures, read every physical page in consecutive batches with `viewImages=true`. Do not substitute an abstract, index, search hits or a representative sample for this request.

If a page's text is truncated, use `research_pdf_read_text` at the returned offset and continue until `nextStartChar` is null. For pages with no extractable text, inspect their actual page images and state that there is no text layer.

Before claiming completion, call `research_pdf_status`. Report total pages, complete text pages, returned image pages, missing pages and failures. Only report complete native-tool coverage when its `complete` field is true for that source. For papers larger than the per-turn image allowance, list the remaining pages and continue in another turn; do not claim completion early.

## Failures and file outputs

- If the native component fails, report its actual error. Do not retry the same failed initialization repeatedly in the same turn.
- A local PDF skill/tool may be used as a fallback only if it is actually available. Explain the fallback and keep its evidence separate from the native-tool coverage report.
- Put intermediate extraction or rendered pages in `tmp/pdfs/`; put user-requested deliverables in `artifacts/`. Do not automatically delete files. The client can fold temporary files and let the user clean them.
- Link source files using ordinary Markdown file links. Do not emit UI-specific file citation directives.
- Reading all pages is access evidence; visual interpretation and numeric claims still require evidence from the pages actually returned. State unreadable labels or ambiguous curves explicitly.
