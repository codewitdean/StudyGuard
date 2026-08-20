# Stage 14A: Progress API Design

## Goal

The goal of Stage 14A is to design the Progress API before we implement it.

StudyGuard already lets students create coursework, mark coursework statuses, generate study plans, and review recommendations. Progress is the next layer: it summarizes what the student completed, what still needs attention, and how much study time was actually logged.

This stage does not add route code yet. The implementation comes in Stage 14B.

## Existing User Flow

Flow 8 from the product notes says:

1. Student marks a task complete or logs study time.
2. Backend records completion status and actual time spent.
3. Dashboard updates progress and remaining workload.
4. Later versions use this data for adaptive effort estimates.

Backend learning involved:

- state changes
- partial updates
- historical records
- metrics from SQL queries

## Existing Progress Screen

The product sketch shows:

```text
Progress
This Week
Completed tasks: 6
Missed tasks: 1
Study time: 8.5h
Estimate accuracy: Usually close

Recent Sessions
Biology lab report     75 min
Calculus practice      45 min
```

Important backend data:

- completed tasks
- missed tasks
- postponed tasks
- actual time spent
- study sessions
- estimate accuracy

## Existing Database Tables

Progress can be built from existing Stage 6 tables.

### `coursework`

Relevant columns:

- `id`
- `user_id`
- `course_id`
- `title`
- `type`
- `due_at`
- `estimated_minutes`
- `status`
- `completed_at`
- `created_at`
- `updated_at`

Allowed progress-related `status` values:

- `not_started`
- `in_progress`
- `completed`
- `postponed`
- `missed`
- `archived`

Important note:

`coursework.completed_at` exists, but there is no `missed_at` or `postponed_at` column yet. For the MVP, completed counts should use `completed_at`, while missed and postponed counts should count current coursework whose `due_at` falls inside the requested range.

### `study_sessions`

Columns:

- `id`
- `user_id`
- `coursework_id`
- `study_block_id`
- `source`
- `started_at`
- `ended_at`
- `duration_minutes`
- `notes`
- `created_at`
- `updated_at`

Allowed `source` values:

- `manual`
- `timer`

Important database rules:

- `user_id` is required
- `duration_minutes` must be greater than 0
- `coursework_id` is optional
- `study_block_id` is optional
- if both `started_at` and `ended_at` exist, `started_at` must be before `ended_at`
- deleting coursework or a study block keeps the session and clears the reference

### `check_ins`

The `check_ins` table exists, but Stage 14A should not include wellbeing check-ins yet.

Check-ins deserve their own product and API pass because they involve energy, stress, focus, supportive copy, and privacy-sensitive interpretation.

## Ownership Rules

The frontend must never send `userId`.

The backend gets ownership from the verified token:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> progress service uses req.user.id in SQL
```

Every progress query must include the signed-in student ID.

If a study session ID exists but belongs to another student, return `404 Not Found` instead of `403 Forbidden`.

If `courseworkId` or `studyBlockId` is provided, the backend must verify that the referenced record belongs to the signed-in student. Return `404 Not Found` when the referenced record is missing or owned by another student.

If both `courseworkId` and `studyBlockId` are provided, and the study block is already linked to a different coursework item, return `400 Bad Request`.

## Planned Endpoint Path

Use `/api/progress` for this feature area.

This keeps progress reporting and study-session logging grouped together while leaving task status changes on the existing `/api/coursework` endpoint.

## Planned Endpoints

### 1. Get Progress Summary

```http
GET /api/progress/summary
```

Authentication required: yes.

Query parameters:

- `from`: optional `YYYY-MM-DD`
- `to`: optional `YYYY-MM-DD`
- `courseId`: optional UUID
- `courseworkId`: optional UUID

Default range:

- if `from` and `to` are omitted, use the current local week
- week starts on Monday and ends on Sunday

Validation rules:

- dates must use `YYYY-MM-DD`
- `from` must be on or before `to`
- the requested range can be at most 366 days for the MVP
- `courseId` must be an owned course when provided
- `courseworkId` must be owned coursework when provided

Success status:

```text
200 OK
```

Success response:

```json
{
  "success": true,
  "data": {
    "progress": {
      "range": {
        "from": "2027-02-15",
        "to": "2027-02-21"
      },
      "taskCounts": {
        "completed": 6,
        "missed": 1,
        "postponed": 2,
        "open": 5,
        "totalDue": 14
      },
      "studyTime": {
        "totalMinutes": 510,
        "sessionCount": 8,
        "averageSessionMinutes": 64
      },
      "estimateAccuracy": {
        "label": "usually_close",
        "comparedCourseworkCount": 4,
        "averageEstimatedMinutes": 105,
        "averageActualMinutes": 112,
        "averageDeltaMinutes": 7
      },
      "recentSessions": []
    }
  }
}
```

Task count behavior:

- `completed`: coursework with `status = 'completed'` and `completed_at` inside the range
- `missed`: coursework with `status = 'missed'` and `due_at` inside the range
- `postponed`: coursework with `status = 'postponed'` and `due_at` inside the range
- `open`: coursework with `status IN ('not_started', 'in_progress')` and `due_at` inside the range
- `totalDue`: all non-archived coursework with `due_at` inside the range

Study time behavior:

- include sessions where `COALESCE(started_at, created_at)` falls inside the range
- sum `duration_minutes`
- average should be rounded to the nearest whole minute

Estimate accuracy behavior:

- compare completed coursework that has at least one linked study session
- actual minutes are the sum of linked study sessions for that coursework
- estimated minutes come from `coursework.estimated_minutes`
- ignore coursework without linked sessions

Allowed `estimateAccuracy.label` values:

- `not_enough_data`
- `usually_close`
- `taking_longer_than_estimated`
- `finishing_faster_than_estimated`
- `mixed`

MVP label rules:

- use `not_enough_data` when there are no comparable coursework items
- use `usually_close` when average actual time is within 25% of average estimated time
- use `taking_longer_than_estimated` when average actual time is more than 25% above average estimated time
- use `finishing_faster_than_estimated` when average actual time is more than 25% below average estimated time
- reserve `mixed` for a later version with per-coursework variance analysis

### 2. List Study Sessions

```http
GET /api/progress/study-sessions
```

Authentication required: yes.

Query parameters:

- `from`: optional `YYYY-MM-DD`
- `to`: optional `YYYY-MM-DD`
- `courseworkId`: optional UUID
- `studyBlockId`: optional UUID
- `source`: optional `manual` or `timer`
- `limit`: optional integer from 1 to 100, default 25

Default behavior:

- return recent sessions newest first
- when no date range is provided, return the most recent sessions regardless of date
- include coursework and study block summaries when references still exist

Success response:

```json
{
  "success": true,
  "data": {
    "studySessions": [
      {
        "id": "9dd03907-5a36-45ed-9ca8-239095394758",
        "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
        "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
        "source": "manual",
        "startedAt": "2027-02-15T20:00:00.000Z",
        "endedAt": "2027-02-15T21:15:00.000Z",
        "durationMinutes": 75,
        "notes": "Finished the outline and methods section.",
        "createdAt": "2027-02-15T21:16:00.000Z",
        "updatedAt": "2027-02-15T21:16:00.000Z",
        "coursework": {
          "id": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
          "title": "Biology lab report",
          "type": "assignment",
          "dueAt": "2027-02-16T22:00:00.000Z",
          "estimatedMinutes": 180,
          "status": "in_progress",
          "course": {
            "id": "1f171eaa-9437-44d6-9d88-0f8432c94b3f",
            "name": "Biology 201",
            "code": "BIO 201"
          }
        },
        "studyBlock": {
          "id": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
          "studyPlanId": "0dedb3f4-32a1-4f46-a4ad-7dd4c6af5159",
          "blockType": "study",
          "startAt": "2027-02-15T20:00:00.000Z",
          "endAt": "2027-02-15T21:30:00.000Z",
          "status": "planned"
        }
      }
    ]
  }
}
```

### 3. Create Study Session

```http
POST /api/progress/study-sessions
```

Authentication required: yes.

Request body:

```json
{
  "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
  "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
  "source": "manual",
  "startedAt": "2027-02-15T20:00:00.000Z",
  "endedAt": "2027-02-15T21:15:00.000Z",
  "durationMinutes": 75,
  "notes": "Finished the outline and methods section."
}
```

Field behavior:

- `courseworkId` is optional
- `studyBlockId` is optional
- `source` defaults to `manual`
- `startedAt` is optional
- `endedAt` is optional
- `durationMinutes` is required
- `notes` is optional

Success status:

```text
201 Created
```

MVP side effects:

- creating a study session does not automatically mark coursework complete
- creating a study session does not automatically mark a study block complete
- task status changes continue to use `PATCH /api/coursework/:courseworkId`

### 4. Get Study Session

```http
GET /api/progress/study-sessions/:studySessionId
```

Authentication required: yes.

Returns one owned study session with coursework and study block summaries when available.

### 5. Update Study Session

```http
PATCH /api/progress/study-sessions/:studySessionId
```

Authentication required: yes.

Editable fields:

- `courseworkId`
- `studyBlockId`
- `source`
- `startedAt`
- `endedAt`
- `durationMinutes`
- `notes`

At least one field must be provided.

If `courseworkId` or `studyBlockId` is changed, the backend must verify ownership again.

### 6. Delete Study Session

```http
DELETE /api/progress/study-sessions/:studySessionId
```

Authentication required: yes.

Success status:

```text
204 No Content
```

## Study Session Validation Rules

General validation:

- `studySessionId` must be a UUID
- `courseworkId` must be a UUID when provided
- `studyBlockId` must be a UUID when provided
- empty string IDs should be normalized to `null`
- `source` must be `manual` or `timer`
- `startedAt` must be an ISO datetime with offset when provided
- `endedAt` must be an ISO datetime with offset when provided
- if both timestamps exist, `startedAt` must be before `endedAt`
- `durationMinutes` must be a positive integer
- `durationMinutes` can be at most 1440 for the MVP
- `notes` should trim empty strings to `null`
- `notes` can be at most 1000 characters

Timer behavior for the MVP:

- timer-created sessions still send a final `durationMinutes`
- the backend stores the submitted duration instead of calculating it from timestamps
- later timer UI stages can add stricter timer-specific rules

## Error Response Pattern

Use the existing API error shape:

```json
{
  "success": false,
  "error": {
    "message": "Study session not found."
  }
}
```

Expected errors:

- `400 Bad Request` for invalid input
- `401 Unauthorized` for missing or invalid auth
- `404 Not Found` for missing or unowned records
- `500 Internal Server Error` for unexpected failures

## Stage 14B Implementation Plan

Stage 14B should add:

- `server/src/validators/progressValidators.js`
- `server/src/services/progressService.js`
- `server/src/controllers/progressController.js`
- `server/src/routes/progressRoutes.js`
- `server/tests/progressRoutes.test.js`
- mount `/api/progress` in `server/src/app.js`

Tests should cover:

- auth is required for every progress route
- users only see their own study sessions and progress metrics
- summary defaults to the current week
- summary filters by date range, course, and coursework
- summary computes task counts from coursework status and dates
- summary computes total study minutes from study sessions
- estimate accuracy returns `not_enough_data` when there are no comparable sessions
- create validates duration, source, timestamps, and owned references
- list filters by date range, coursework, study block, source, and limit
- get returns nested coursework and study block summaries
- update revalidates references and requires at least one field
- delete removes only owned study sessions

## What This Stage Does Not Build Yet

Stage 14A does not implement:

- Express routes
- study-session CRUD code
- progress summary SQL
- frontend progress screen
- timer UI
- wellbeing check-ins
- grade analytics
- adaptive effort estimate updates

Those pieces should come after the API contract is clear.
