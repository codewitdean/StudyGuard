# Stage 14B: Progress API Implementation

## Goal

Stage 14B implements the backend Progress API designed in Stage 14A.

Students can now log study sessions, manage those historical records, and load summary progress metrics for a date range.

## Implemented Files

- `server/src/validators/progressValidators.js`
- `server/src/services/progressService.js`
- `server/src/controllers/progressController.js`
- `server/src/routes/progressRoutes.js`
- `server/tests/progressRoutes.test.js`
- `server/src/app.js`

## Endpoint Mount

The route is mounted at:

```http
/api/progress
```

All progress routes require authentication.

## Implemented Endpoints

### Progress Summary

```http
GET /api/progress/summary
```

Supported filters:

- `from`
- `to`
- `courseId`
- `courseworkId`

The summary returns:

- range
- completed, missed, postponed, open, and total due task counts
- total study minutes
- session count
- average session minutes
- estimate accuracy label and averages
- recent sessions for the selected range

### List Study Sessions

```http
GET /api/progress/study-sessions
```

Supported filters:

- `from`
- `to`
- `courseworkId`
- `studyBlockId`
- `source`
- `limit`

Sessions return newest first and include coursework and study block summaries when references still exist.

### Create Study Session

```http
POST /api/progress/study-sessions
```

Creates a study session owned by the signed-in student.

The backend validates:

- duration is a positive integer up to 1440 minutes
- source is `manual` or `timer`
- timestamps are valid ISO datetimes when provided
- `startedAt` is before `endedAt` when both exist
- linked coursework belongs to the student
- linked study block belongs to the student
- linked study block does not point to a different coursework item when both references are provided

### Get Study Session

```http
GET /api/progress/study-sessions/:studySessionId
```

Returns one owned study session.

### Update Study Session

```http
PATCH /api/progress/study-sessions/:studySessionId
```

Updates one owned study session.

Editable fields:

- `courseworkId`
- `studyBlockId`
- `source`
- `startedAt`
- `endedAt`
- `durationMinutes`
- `notes`

The service revalidates ownership for changed coursework and study block references.

### Delete Study Session

```http
DELETE /api/progress/study-sessions/:studySessionId
```

Deletes one owned study session.

## Ownership Behavior

Every query is scoped by `req.user.id`.

The frontend never sends `userId`.

Cross-user access returns `404 Not Found`, matching the rest of the StudyGuard backend.

## Summary Behavior

Task counts come from `coursework`:

- `completed`: completed coursework with `completed_at` inside the range
- `missed`: missed coursework with `due_at` inside the range
- `postponed`: postponed coursework with `due_at` inside the range
- `open`: not-started or in-progress coursework with `due_at` inside the range
- `totalDue`: non-archived coursework with `due_at` inside the range

Study time comes from `study_sessions` using `COALESCE(started_at, created_at)` for date-range filtering.

Estimate accuracy compares completed coursework estimates against linked study-session duration totals.

## Important Implementation Boundary

Stage 14B does not automatically mark coursework or study blocks complete when a study session is created.

Task status changes still go through the existing coursework endpoint:

```http
PATCH /api/coursework/:courseworkId
```

This keeps historical study logs separate from task state changes.

## Test Coverage

Added `server/tests/progressRoutes.test.js`.

The tests cover:

- auth requirements for every route
- invalid summary, list, create, update, and ID inputs
- creating study sessions with nested summaries
- rejecting cross-user coursework and study block references
- rejecting mismatched coursework and study block references
- list filters for date range, coursework, study block, source, and limit
- cross-user study-session privacy
- updating owned study sessions and clearing optional links
- rejecting timestamp updates that would violate ordering
- progress summary task counts, study time, recent sessions, and estimate accuracy
- empty default-week summaries
- deleting owned study sessions

Targeted test result:

```text
Test Files  1 passed (1)
Tests       11 passed (11)
```

## Next Stage

Stage 14C should add the frontend Progress dashboard:

- progress API client
- summary cards
- recent session list
- manual study-session form
- filters by date range
- loading, empty, success, and error states
