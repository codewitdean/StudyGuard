# Stage 10B: Coursework CRUD API Implementation

## Goal

The goal of Stage 10B is to implement the protected Coursework API designed in Stage 10A.

Students can now create, list, view, update, complete, archive, and delete their own coursework through authenticated backend routes.

This stage is backend-only. The browser UI for coursework comes next in Stage 10C.

## Endpoints Added

All coursework routes require a JWT bearer token.

```http
GET /api/coursework
POST /api/coursework
GET /api/coursework/:courseworkId
PATCH /api/coursework/:courseworkId
DELETE /api/coursework/:courseworkId
```

## Files Added Or Changed

### `server/src/validators/courseworkValidators.js`

Adds Zod schemas for coursework requests.

The validators handle:

- list query filters
- create request bodies
- UUID route params
- update request bodies
- allowed coursework type values
- allowed priority, difficulty, and status values
- ISO date-time validation for `dueAt`
- numeric validation for `estimatedMinutes` and `gradeWeight`
- converting empty optional strings to `null`

### `server/src/services/courseworkService.js`

Contains the coursework business logic and SQL.

It maps database rows from snake_case to API-friendly camelCase:

```text
course_id -> courseId
due_at -> dueAt
estimated_minutes -> estimatedMinutes
grade_weight -> gradeWeight
completed_at -> completedAt
created_at -> createdAt
updated_at -> updatedAt
```

It also includes a course summary when coursework belongs to a course:

```json
{
  "course": {
    "id": "course-id",
    "name": "Biology I",
    "code": "BIO 101",
    "color": "#10B981"
  }
}
```

Every read, update, and delete query is scoped by the signed-in student's `userId`.

### `server/src/controllers/courseworkController.js`

Contains the HTTP controller functions for the coursework routes.

Controllers stay thin. They read validated data, call the service, and return JSON responses.

### `server/src/routes/courseworkRoutes.js`

Defines the protected Express router for `/api/coursework`.

The router uses:

- `requireAuth` to verify the JWT
- `validateRequest` to validate params, query, and body data
- `asyncHandler` to send thrown errors to the shared error handler

### `server/src/app.js`

Mounts coursework routes with:

```js
app.use("/api/coursework", courseworkRoutes);
```

### `server/tests/courseworkRoutes.test.js`

Adds endpoint tests for the protected coursework API.

## Response Shape

List responses use `coursework` because they return an array:

```json
{
  "success": true,
  "data": {
    "coursework": []
  }
}
```

Single-item responses use `courseworkItem` because `coursework` is an uncountable word:

```json
{
  "success": true,
  "data": {
    "courseworkItem": {
      "id": "coursework-id",
      "title": "Biology lab report"
    }
  }
}
```

Delete success returns `204 No Content` with an empty response body.

## Ownership Pattern

The client never sends `user_id`.

The route gets ownership from auth middleware:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id is attached
-> coursework controller passes req.user.id to the service
-> SQL uses user_id = req.user.id
```

This prevents one student from seeing or modifying another student's coursework.

## Course Relationship Rule

Coursework can exist without a course because some tasks are personal study tasks.

When `courseId` is provided, the service first checks:

```sql
SELECT id
FROM courses
WHERE id = $1 AND user_id = $2;
```

If no owned course is found, the API returns `404 Course not found.`

That keeps another student's course IDs private.

## List Coursework Filters

Default:

```http
GET /api/coursework
```

Returns open coursework only. Open means:

- `not_started`
- `in_progress`
- `postponed`

Supported filters:

```http
GET /api/coursework?status=open
GET /api/coursework?status=completed
GET /api/coursework?status=all
GET /api/coursework?courseId=course-uuid
GET /api/coursework?type=assignment
GET /api/coursework?due=upcoming
GET /api/coursework?due=overdue
GET /api/coursework?due=no_due_date
GET /api/coursework?sort=effortHigh
```

Supported sort values:

- `dueDate`
- `createdNewest`
- `effortHigh`

## Create Coursework Flow

```text
Client
-> POST /api/coursework
-> requireAuth
-> validateRequest(createCourseworkSchema)
-> courseworkController.createCoursework
-> courseworkService.createCourseworkForUser
-> service confirms course ownership if courseId exists
-> INSERT INTO coursework with user_id from req.user.id
-> 201 response with the new coursework item
```

## Request Body Examples

Create:

```json
{
  "courseId": "course-id-or-null",
  "title": "Biology lab report",
  "description": "Write the enzyme lab report.",
  "type": "assignment",
  "dueAt": "2027-02-16T02:00:00.000Z",
  "priority": "high",
  "difficulty": "hard",
  "estimatedMinutes": 180,
  "gradeWeight": 12.5,
  "topic": "Enzymes",
  "notes": "Start with data table cleanup."
}
```

Update:

```json
{
  "title": "Biology lab report draft",
  "status": "in_progress",
  "estimatedMinutes": 210
}
```

## Completion Behavior

The frontend does not send `completedAt` directly.

The backend controls completion timestamps:

- Changing `status` to `completed` sets `completed_at`
- Changing `status` away from `completed` clears `completed_at`

This keeps status and timestamp data consistent.

## Error Responses

Missing token:

```json
{
  "success": false,
  "error": {
    "message": "Authentication required."
  }
}
```

Invalid request data:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed.",
    "details": []
  }
}
```

Coursework missing or not owned by user:

```json
{
  "success": false,
  "error": {
    "message": "Coursework item not found."
  }
}
```

Course missing or not owned by user:

```json
{
  "success": false,
  "error": {
    "message": "Course not found."
  }
}
```

## Tests

The Stage 10B tests prove:

- Coursework routes require authentication
- A signed-in student can create coursework without a course
- A signed-in student can create coursework for an owned course
- Another student's course cannot be attached
- Optional empty strings become `null`
- Invalid create bodies return `400`
- Invalid list filters return `400`
- Default listing returns open owned coursework only
- Course, type, status, due, and sort filters work
- A signed-in student can get one owned coursework item
- Another student's coursework returns `404`
- A signed-in student can update coursework fields
- Changing status to `completed` sets `completedAt`
- Changing status away from `completed` clears `completedAt`
- Empty updates return `400`
- Invalid UUID params return `400`
- A signed-in student can delete an owned coursework item
- Existing auth, health, and course tests still pass

## Commands

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Manual create test:

```bash
curl -i -X POST http://127.0.0.1:4000/api/coursework \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token-here" \
  -d '{"title":"Biology lab report","type":"assignment","estimatedMinutes":180}'
```

## Stage 10B Acceptance Criteria

Stage 10B is complete when:

- `GET /api/coursework` exists
- `POST /api/coursework` exists
- `GET /api/coursework/:courseworkId` exists
- `PATCH /api/coursework/:courseworkId` exists
- `DELETE /api/coursework/:courseworkId` exists
- All coursework routes require authentication
- Coursework validation works
- Course ownership is checked before saving `courseId`
- Owner-scoped SQL prevents cross-user access
- Completion status controls `completedAt`
- Coursework route tests pass
- Existing auth, health, and course tests still pass
- You approve moving to Stage 10C

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - complete
- Stage 5: PostgreSQL and database fundamentals - complete
- Stage 6: Database schema and migrations - complete
- Stage 7: Basic Express server and health endpoint - complete
- Stage 8A: Authentication API design - complete
- Stage 8B: Authentication dependencies and environment setup - complete
- Stage 8C: Register endpoint - complete
- Stage 8D: Login endpoint - complete
- Stage 8E: Protected current-user route - complete
- Stage 8F: Frontend auth forms and token storage - complete
- Stage 9A: Courses API design - complete
- Stage 9B: Courses CRUD API implementation - complete
- Stage 9C: Frontend course management - complete
- Stage 10A: Coursework API design - complete
- Stage 10B: Coursework CRUD API implementation - complete
- Stage 10C: Frontend coursework management - complete
- Stage 11A: Availability API design - complete
- Stage 11B: Availability CRUD API implementation - complete
- Stage 11C: Frontend availability management - complete
- Stage 12A: Study plan API design - complete
- Stage 12B: Study plan generation API implementation - complete
- Stage 12C: Frontend study plan generation - complete
- Stage 13A: Recommendations API design - not started

## Understanding Check

Before Stage 10C, make sure you can answer these:

1. Why does `courseId` need an ownership check before coursework is saved?
2. Why does `GET /api/coursework` default to open work only?
3. Why does the backend control `completedAt` instead of the frontend?
4. Why do single-item responses use `courseworkItem`?
