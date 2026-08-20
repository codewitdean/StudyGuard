# Stage 13A: Recommendations API Design

## Goal

The goal of Stage 13A is to design the Recommendations API before we implement it.

StudyGuard already knows what work exists, when the student is available, and how a draft study plan is generated. Recommendations are the next layer: they explain suggested schedule or workload changes and ask the student to approve, edit, or reject them.

This stage does not add route code yet. The implementation comes in Stage 13B.

## Product Rule

StudyGuard must not silently change a student's schedule.

A recommendation can suggest a change, but the backend should only treat the change as accepted after the student approves it. If the student edits a recommendation first, the edited version becomes the accepted version when approved.

## Existing User Flow

Flow 7 from the product notes says:

1. Student opens Recommendations.
2. Student reviews suggestions such as moving a block, splitting a task, or starting earlier.
3. Student approves, edits, or rejects each recommendation.
4. Backend saves only approved changes.
5. Dashboard updates after approval.

Backend learning involved:

- recommendation status
- batch updates
- approval workflow
- audit-friendly behavior

## Existing Database Table

The `recommendations` table already exists from Stage 6.

Columns:

- `id`
- `user_id`
- `coursework_id`
- `study_block_id`
- `type`
- `status`
- `title`
- `reason`
- `proposed_change`
- `edited_change`
- `decided_at`
- `created_at`
- `updated_at`

Allowed `type` values:

- `move_block`
- `split_task`
- `start_earlier`
- `add_break`
- `reestimate_effort`
- `seek_support`
- `postpone_lower_priority`

Allowed `status` values:

- `pending`
- `edited`
- `approved`
- `rejected`

Important database rules:

- `user_id` is required
- `coursework_id` is optional
- `study_block_id` is optional
- `title` must be 1 to 200 trimmed characters
- `reason` must be 1 to 1000 trimmed characters
- `proposed_change` is required JSONB
- `edited_change` is optional JSONB
- deleting a user deletes their recommendations
- deleting coursework or a study block keeps the recommendation and clears the reference

## Ownership Rules

The frontend must never send `userId`.

The backend gets ownership from the verified token:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> recommendation service uses req.user.id in SQL
```

Every recommendation query must include the signed-in student ID.

If a recommendation ID exists but belongs to another student, return `404 Not Found` instead of `403 Forbidden`.

If `courseworkId` or `studyBlockId` is provided, the backend must verify that the referenced record belongs to the signed-in student. Return `404 Not Found` when the referenced record is missing or owned by another student.

## Planned Endpoint Path

Use `/api/recommendations` for this feature area.

## Recommendation Response Shape

Single recommendation responses should use this shape:

```json
{
  "recommendation": {
    "id": "34a077c7-2a7b-4c8b-a21b-678af0bc86d0",
    "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
    "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
    "type": "move_block",
    "status": "pending",
    "title": "Move biology review earlier",
    "reason": "This block is currently close to the deadline and outside your preferred study window.",
    "proposedChange": {
      "action": "move_block",
      "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
      "startAt": "2026-08-21T20:00:00.000Z",
      "endAt": "2026-08-21T21:30:00.000Z"
    },
    "editedChange": null,
    "decidedAt": null,
    "createdAt": "2026-08-19T12:00:00.000Z",
    "updatedAt": "2026-08-19T12:00:00.000Z",
    "coursework": {
      "id": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
      "title": "Biology lab report",
      "type": "assignment",
      "dueAt": "2026-08-23T22:00:00.000Z",
      "priority": "high",
      "difficulty": "medium",
      "estimatedMinutes": 180,
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
      "startAt": "2026-08-22T20:00:00.000Z",
      "endAt": "2026-08-22T21:30:00.000Z",
      "status": "planned"
    }
  }
}
```

List responses should use this shape:

```json
{
  "recommendations": []
}
```

## Proposed Change Shape

`proposedChange` and `editedChange` should be JSON objects, not arrays or primitive values.

Each object should include an `action` field that matches the recommendation type when possible.

Example action payloads:

```json
{
  "action": "move_block",
  "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
  "startAt": "2026-08-21T20:00:00.000Z",
  "endAt": "2026-08-21T21:30:00.000Z"
}
```

```json
{
  "action": "split_task",
  "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
  "blocks": [
    {
      "startAt": "2026-08-20T20:00:00.000Z",
      "endAt": "2026-08-20T21:00:00.000Z"
    },
    {
      "startAt": "2026-08-21T20:00:00.000Z",
      "endAt": "2026-08-21T21:00:00.000Z"
    }
  ]
}
```

```json
{
  "action": "reestimate_effort",
  "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
  "estimatedMinutes": 240
}
```

Stage 13B should validate that these values are JSON objects. Full action-specific validation and automatic schedule mutation can grow after the basic approval workflow exists.

## Planned Endpoints

### 1. List Recommendations

```http
GET /api/recommendations
```

Authentication required: yes.

Query parameters:

- `status`: optional, one of `pending`, `edited`, `approved`, `rejected`, or `all`
- `type`: optional, one of the allowed recommendation types or `all`
- `courseworkId`: optional UUID
- `studyBlockId`: optional UUID

Default behavior:

- return pending and edited recommendations
- sort newest first by `created_at`
- include coursework and study block summaries when references still exist

Success status:

```text
200 OK
```

Success response:

```json
{
  "recommendations": []
}
```

### 2. Create Recommendation

```http
POST /api/recommendations
```

Authentication required: yes.

This endpoint lets the backend, tests, or future generation logic create a recommendation owned by the signed-in student. The frontend can also use it during development before automatic recommendation generation exists.

Request body:

```json
{
  "courseworkId": "5230c258-0f2b-4f1d-9d45-909af1b1b2e1",
  "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
  "type": "move_block",
  "title": "Move biology review earlier",
  "reason": "This block is currently close to the deadline and outside your preferred study window.",
  "proposedChange": {
    "action": "move_block",
    "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
    "startAt": "2026-08-21T20:00:00.000Z",
    "endAt": "2026-08-21T21:30:00.000Z"
  }
}
```

Field behavior:

- `courseworkId` is optional
- `studyBlockId` is optional
- `type` is required
- `title` is required
- `reason` is required
- `proposedChange` is required and defaults to an empty object only if the route chooses to allow it
- `status`, `editedChange`, and `decidedAt` are not accepted on create
- created recommendations always start as `pending`

Success status:

```text
201 Created
```

### 3. Get Recommendation

```http
GET /api/recommendations/:recommendationId
```

Authentication required: yes.

Success status:

```text
200 OK
```

Not found behavior:

- return `404 Not Found` if the recommendation does not exist
- return `404 Not Found` if the recommendation belongs to another student

### 4. Edit Recommendation

```http
PATCH /api/recommendations/:recommendationId
```

Authentication required: yes.

This endpoint stores the student's edited version of the proposed change.

Request body:

```json
{
  "editedChange": {
    "action": "move_block",
    "studyBlockId": "6a7e03a7-2a26-49f4-a2b1-798eabf9cc31",
    "startAt": "2026-08-21T19:30:00.000Z",
    "endAt": "2026-08-21T21:00:00.000Z"
  }
}
```

Behavior:

- only `pending` or `edited` recommendations can be edited
- set `status` to `edited`
- set `edited_change` to the submitted object
- set `decided_at` to now because the student made a review decision
- keep `proposed_change` unchanged for auditability

Success status:

```text
200 OK
```

Conflict behavior:

- return `409 Conflict` if the recommendation is already `approved` or `rejected`

### 5. Approve Recommendation

```http
POST /api/recommendations/:recommendationId/approve
```

Authentication required: yes.

Behavior:

- only `pending` or `edited` recommendations can be approved
- set `status` to `approved`
- set `decided_at` to now
- keep both `proposed_change` and `edited_change` for auditability
- when `edited_change` exists, treat it as the accepted change
- when `edited_change` is null, treat `proposed_change` as the accepted change

Stage 13B should record the approval decision. Action-specific mutation of study blocks, coursework estimates, or future study plan regeneration should be implemented behind a service boundary once each action can be validated safely.

Success status:

```text
200 OK
```

Conflict behavior:

- return `409 Conflict` if the recommendation is already `approved` or `rejected`

### 6. Reject Recommendation

```http
POST /api/recommendations/:recommendationId/reject
```

Authentication required: yes.

Behavior:

- only `pending` or `edited` recommendations can be rejected
- set `status` to `rejected`
- set `decided_at` to now
- do not change coursework, study blocks, or study plans

Success status:

```text
200 OK
```

Conflict behavior:

- return `409 Conflict` if the recommendation is already `approved` or `rejected`

### 7. Delete Recommendation

```http
DELETE /api/recommendations/:recommendationId
```

Authentication required: yes.

This endpoint is useful for cleanup and development tools. The normal student-facing workflow should prefer reject over delete so decisions remain audit-friendly.

Success status:

```text
204 No Content
```

## Validation Rules

General validation:

- `recommendationId` must be a UUID
- `courseworkId` must be a UUID when provided
- `studyBlockId` must be a UUID when provided
- `type` must be one of the allowed recommendation types
- `status` filters must be allowed values or `all`
- `title` must trim to 1 to 200 characters
- `reason` must trim to 1 to 1000 characters
- `proposedChange` must be a plain JSON object
- `editedChange` must be a plain JSON object
- arrays, strings, numbers, booleans, and null are not valid change objects

Status transition rules:

- `pending -> edited` is allowed
- `pending -> approved` is allowed
- `pending -> rejected` is allowed
- `edited -> approved` is allowed
- `edited -> rejected` is allowed
- `approved` is terminal
- `rejected` is terminal

## Error Response Pattern

Use the existing API error shape:

```json
{
  "error": {
    "message": "Recommendation not found"
  }
}
```

Expected errors:

- `400 Bad Request` for invalid input
- `401 Unauthorized` for missing or invalid auth
- `404 Not Found` for missing or unowned records
- `409 Conflict` for invalid status transitions
- `500 Internal Server Error` for unexpected failures

## Stage 13B Implementation Plan

Stage 13B should add:

- `server/src/validators/recommendationValidators.js`
- `server/src/services/recommendationService.js`
- `server/src/controllers/recommendationController.js`
- `server/src/routes/recommendationRoutes.js`
- `server/tests/recommendationRoutes.test.js`
- mount `/api/recommendations` in `server/src/app.js`

Tests should cover:

- auth is required for every route
- users only see their own recommendations
- create validates title, reason, type, and JSON change shape
- create verifies owned coursework and study block references
- list filters by status, type, coursework, and study block
- get returns nested coursework and study block summaries
- edit stores `edited_change` and sets status to `edited`
- approve sets status to `approved` and stores `decided_at`
- reject sets status to `rejected` and stores `decided_at`
- approved and rejected recommendations cannot be edited, approved again, or rejected again
- delete removes only owned recommendations

## What This Stage Does Not Build Yet

Stage 13A does not implement:

- Express routes
- automatic recommendation generation
- schedule mutation after approval
- frontend recommendation review UI
- dashboard refresh behavior

Those pieces should come after the API contract is clear.
