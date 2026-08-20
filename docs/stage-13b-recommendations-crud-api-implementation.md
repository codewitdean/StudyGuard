# Stage 13B: Recommendations CRUD API Implementation

## Goal

Stage 13B implements the backend Recommendations API designed in Stage 13A.

Students can now create, list, inspect, edit, approve, reject, and delete recommendations through authenticated API routes.

## Implemented Files

- `server/src/validators/recommendationValidators.js`
- `server/src/services/recommendationService.js`
- `server/src/controllers/recommendationController.js`
- `server/src/routes/recommendationRoutes.js`
- `server/tests/recommendationRoutes.test.js`
- `server/src/app.js`

## Endpoint Mount

The route is mounted at:

```http
/api/recommendations
```

All recommendation routes require authentication.

## Implemented Endpoints

### List Recommendations

```http
GET /api/recommendations
```

Supported filters:

- `status`
- `type`
- `courseworkId`
- `studyBlockId`

Default list behavior returns recommendations that still need review:

- `pending`
- `edited`

### Create Recommendation

```http
POST /api/recommendations
```

Creates a recommendation owned by the signed-in student.

The backend validates:

- allowed recommendation type
- title length
- reason length
- `proposedChange` JSON object shape
- owned coursework reference when provided
- owned study block reference when provided

New recommendations always start as `pending`.

### Get Recommendation

```http
GET /api/recommendations/:recommendationId
```

Returns one owned recommendation with optional coursework and study block summaries.

### Edit Recommendation

```http
PATCH /api/recommendations/:recommendationId
```

Stores `editedChange`, sets status to `edited`, and preserves `proposedChange` for auditability.

Only `pending` and `edited` recommendations can be edited.

### Approve Recommendation

```http
POST /api/recommendations/:recommendationId/approve
```

Sets status to `approved` and records `decidedAt`.

Only `pending` and `edited` recommendations can be approved.

### Reject Recommendation

```http
POST /api/recommendations/:recommendationId/reject
```

Sets status to `rejected` and records `decidedAt`.

Only `pending` and `edited` recommendations can be rejected.

### Delete Recommendation

```http
DELETE /api/recommendations/:recommendationId
```

Deletes one owned recommendation.

The normal student-facing workflow should prefer rejection over deletion, but delete is useful for cleanup and development tools.

## Ownership Behavior

Every recommendation query is scoped by `req.user.id`.

The frontend never sends `userId`.

Cross-user access returns `404 Not Found`, matching the existing API behavior for courses, coursework, availability, and study plans.

## Status Transition Rules

Allowed transitions:

- `pending -> edited`
- `pending -> approved`
- `pending -> rejected`
- `edited -> approved`
- `edited -> rejected`

Terminal statuses:

- `approved`
- `rejected`

Trying to edit, approve, or reject a terminal recommendation returns `409 Conflict`.

## Test Coverage

Added `server/tests/recommendationRoutes.test.js`.

The tests cover:

- auth requirements for every route
- invalid bodies, filters, and ID params
- creating owned recommendations with nested coursework and study block summaries
- rejecting cross-user coursework and study block references
- default and explicit list filters
- cross-user recommendation privacy
- editing while preserving proposed changes
- approving pending and edited recommendations
- rejecting pending and edited recommendations
- terminal status conflicts
- deleting owned recommendations

Targeted test result:

```text
Test Files  1 passed (1)
Tests       11 passed (11)
```

## Important Implementation Boundary

Stage 13B records the student's recommendation decision.

It does not yet mutate study blocks, coursework estimates, or regenerate study plans after approval. Those action-specific effects should be added behind a dedicated service boundary after each recommendation action has strict validation rules.

## Next Stage

Stage 13C should add the frontend recommendation review experience:

- recommendations API client
- Recommendations panel or tab
- pending and edited recommendation list
- approve, edit, reject, and delete actions
- clear empty, loading, and error states
