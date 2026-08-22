# Stage 18: Syllabus Import

Status: implementation complete, browser QA pending.

## Goal

Allow a student to upload a PDF, Word .docx, text, Markdown, or CSV syllabus for a specific course, preview extracted coursework dates, and import selected items into the existing coursework list.

## Backend

- `POST /api/coursework/syllabus/preview` validates the course, parses pasted syllabus text, and returns suggested coursework items.
- `POST /api/coursework/syllabus/upload-preview` validates the course, extracts text from an uploaded syllabus file, and returns suggested coursework items.
- `POST /api/coursework/syllabus/import` validates selected items, creates coursework rows for the course, and skips exact duplicates by title and due date.
- The parser recognizes common syllabus date formats, coursework keywords, type hints, grade weights, default effort estimates, and due times.
- Stage 20 extends this flow with an optional smart AI reader for workload expectations, assigned dates, due dates, calendar tables, and key events.

## Frontend

- Coursework now includes a Syllabus Upload panel.
- The browser sends PDF, Word .docx, text, Markdown, and CSV files to the backend upload parser.
- Uploads are limited to 15 MB.
- Students can preview, edit, select, and import extracted items.
- Imported items appear in the normal coursework table filtered to the selected course.

## Summer-To-Fall QA Strategy

Use the completed Summer 2026 semester as the historical source of truth for improving fall syllabus import. Summer syllabi and completed coursework should be compared against imported items to tune date extraction, task type inference, effort defaults, and duplicate handling before relying on the feature for Fall 2026 planning.

## QA Sample

Use `docs/sample-syllabus-import.txt` to test the browser upload flow.

## Current Limitation

Modern Word `.docx` files are supported. Legacy `.doc` files should be saved as `.docx` or PDF before upload. Scanned image-only PDFs need selectable text before StudyGuard can extract dates.

## Change Log

### August 20, 2026

- Added the first syllabus import flow for pasted text and text-like uploads.
- Added preview, edit, select, and import behavior in the Coursework screen.
- Added duplicate skipping by exact title and due date.
- Added backend upload parsing for PDF, Word `.docx`, text, Markdown, and CSV files.
- Increased syllabus upload support to 15 MB.
- Added clear unsupported-file and unreadable-file errors.
- Verified PDF and DOCX uploads through the live local API.
- Verified full server tests, client build, and format check.
- Added completed Summer 2026 seed baseline as the test semester for improving Fall 2026 syllabus import.
- Added Stage 20 handoff notes for the optional smart AI syllabus reader.

## Documentation Policy

All future changes to syllabus import behavior should be added to this document before the work is considered complete. Cross-feature changes should also be recorded in the relevant stage document and README status when applicable.
