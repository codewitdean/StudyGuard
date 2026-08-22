# Stage 21: Syllabus Calendar Extraction Tuning

Status: implementation complete, browser QA pending.

## Goal

Improve syllabus import accuracy after browser testing showed that the upload flow worked but StudyGuard did not read the syllabus data well enough. The focus is real syllabus calendar layouts where dates, assignment names, assigned dates, due dates, and weekly ranges may be split across table columns or PDF-extracted lines.

## Problem Found

The first parser handled simple lines like `Sep 3 - Quiz 1 due 11:59 PM`, but many syllabi use structures like:

```text
Week | Dates | Topic | Work Due
1 | Sep 2-8 | Course setup | Syllabus Quiz due Sunday
2 | Sep 9 | Research basics | Annotated Bibliography assigned Sep 9 due Sep 16
Sep 23
Project Proposal due 11:59 PM
```

The old local parser could split the date away from the task or choose the first date in a row instead of the actual due date.

## Backend Changes

- Preserved full calendar rows before splitting table cells.
- Added candidate rows that combine nearby PDF-extracted lines, so a date on one line can be paired with the task on the next line.
- Added month-name date range parsing such as `Sep 2-8` and `September 2 to September 8`.
- Added due-date preference logic so dates after `due`, `deadline`, `submit`, or `closes` are preferred over assigned/open dates.
- Added weekday-in-range handling so `Sep 2-8 ... due Sunday` maps to the Sunday inside that range.
- Added assigned-date extraction for local parser preview items. Assigned dates are included in preview metadata and notes for now because the current coursework table stores due dates, not a separate assigned-date column.
- Improved title cleanup for table rows, removing date columns, week labels, weekday words, and assigned/due labels.
- Improved the AI reader prompt with explicit instructions for table rows, date ranges, assigned dates, and due dates.

## Frontend Impact

No new screen was needed. The existing Syllabus Upload preview should show cleaner task titles and better due dates after the backend parser improvements.

## QA Strategy

Use completed Summer 2026 syllabi as regression samples. Compare imported preview rows against completed Summer 2026 coursework, with special attention to:

- rows where date and assignment are in different cells
- rows with both assigned and due dates
- rows with date ranges and weekday due language
- PDF extraction where a date lands on one line and a task lands on the next

## Verification

- Added route regression coverage for calendar table rows, date ranges, assigned dates, and split PDF-style lines.
- Existing syllabus preview/import tests still cover simple line-based syllabi.

## Change Log

### August 20, 2026

- Tuned syllabus parser after real upload testing showed poor data extraction.
- Added table-row preservation and nearby-line candidate extraction.
- Added date-range and weekday due-date support.
- Added assigned-date detection to local preview items.
- Updated the AI reader prompt for syllabus calendars.
- Expanded the sample syllabus file with a calendar-table example.
