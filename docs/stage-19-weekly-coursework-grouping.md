# Stage 19: Weekly Coursework Grouping

Status: implementation complete, browser QA pending.

## Goal

Make the Coursework screen easier to scan by grouping visible coursework into due-date weeks.

## Implementation

- Added frontend helpers to convert coursework due dates into local Monday-Sunday week groups.
- Added relative labels for Last Week, This Week, and Next Week.
- Added chronological group headers inside the existing coursework table.
- Added group-level item count, total effort, and overdue count.
- Added a No Due Date group for coursework without deadlines.
- Kept existing coursework filters, sort selection, edit, archive, complete, restore, and delete actions.

## Scope

- No database migration was needed.
- No backend API change was needed.
- Grouping is applied to the currently visible filtered coursework list.

## Summer-To-Fall QA Strategy

Use completed Summer 2026 coursework to validate historical weekly grouping before tuning fall planning. The summer baseline should confirm that completed tasks group into the right Monday-Sunday buckets, archived summer courses remain filterable, and completed work can be reviewed without mixing it into active fall planning by accident.

## Verification

- Client production build passes.

## Browser QA

- Confirm Coursework rows are grouped by week.
- Confirm no-due-date coursework appears under No Due Date.
- Confirm filters still update the visible groups.
- Confirm Complete, Reopen, Archive, Restore, Edit, and Delete still work from grouped rows.

## Change Log

### August 20, 2026

- Implemented weekly grouping in the Coursework table.
- Added weekly group summary counts and effort totals.
- Updated README stage status.
- Added completed Summer 2026 seed data as historical weekly grouping QA input.
