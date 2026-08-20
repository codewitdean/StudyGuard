# Stage 9B: Courses CRUD API Implementation

## Goal

The goal of Stage 9B is to implement the protected Courses API designed in Stage 9A.

Students can now create, list, view, update, archive, unarchive, and delete their own courses through authenticated backend routes.

## Endpoints Added

All course routes require a JWT bearer token.

```http
GET /api/courses
POST /api/courses
GET /api/courses/:courseId
PATCH /api/courses/:courseId
DELETE /api/courses/:courseId
```

## Files Added or Changed

### `server/src/validators/courseValidators.js`

Adds Zod schemas for course requests.

The validators handle:

- list query status filters
- create request bodies
- UUID route params
- update request bodies
- converting empty optional strings to `null`

### `server/src/services/courseService.js`

Contains the course business logic and SQL.

It maps database rows from snake_case to API-friendly camelCase:

```text
target_grade -> targetGrade
is_archived -> isArchived
created_at -> createdAt
updated_at -> updatedAt
```

Every read, update, and delete query is scoped by the signed-in student's `userId`.

### `server/src/controllers/courseController.js`

Contains the HTTP controller functions for the course routes.

Controllers are intentionally thin. They read validated data, call the service, and shape the JSON response.

### `server/src/routes/courseRoutes.js`

Defines the protected Express router for `/api/courses`.

The router uses:

- `requireAuth` to verify the JWT
- `validateRequest` to validate params, query, and body data
- `asyncHandler` to send thrown errors to the shared error handler

### `server/src/app.js`

Mounts course routes with:

```js
app.use("/api/courses", courseRoutes);
```

### `server/src/utils/httpErrors.js`

Adds a `notFound` helper for `404` errors.

### `server/tests/courseRoutes.test.js`

Adds endpoint tests for the protected courses API.

## Ownership Pattern

The client never sends `user_id`.

The route gets ownership from auth middleware:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id is attached
-> course controller passes req.user.id to the service
-> SQL uses user_id = req.user.id
```

This prevents one student from seeing or modifying another student's courses.

## Create Course Flow

```text
Client
-> POST /api/courses
-> requireAuth
-> validateRequest(createCourseSchema)
-> courseController.createCourse
-> courseService.createCourseForUser
-> INSERT INTO courses with user_id from req.user.id
-> 201 response with the new course
```

## List Course Filters

Default:

```http
GET /api/courses
```

Returns active courses only.

Archived courses:

```http
GET /api/courses?status=archived
```

All courses:

```http
GET /api/courses?status=all
```

## Request Body Examples

Create:

```json
{
  "name": "Biology I",
  "code": "BIO 101",
  "instructor": "Dr. Rivera",
  "color": "#10B981",
  "term": "Spring 2027",
  "targetGrade": "A-"
}
```

Update:

```json
{
  "name": "Biology Lab",
  "isArchived": true
}
```

## Response Examples

Single course response:

```json
{
  "success": true,
  "data": {
    "course": {
      "id": "course-id",
      "name": "Biology I",
      "code": "BIO 101",
      "instructor": "Dr. Rivera",
      "color": "#10B981",
      "term": "Spring 2027",
      "targetGrade": "A-",
      "isArchived": false,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
}
```

Delete success returns `204 No Content` with an empty response body.

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

Course missing or not owned by user:

```json
{
  "success": false,
  "error": {
    "message": "Course not found."
  }
}
```

## Important Backend Choices

### Use Owner-Scoped SQL

The service uses queries such as:

```sql
WHERE id = $1 AND user_id = $2
```

That checks both the requested course and the authenticated owner in one database operation.

### Use `404` For Missing Or Not-Owned Courses

A student should not learn whether another student's course exists.

Returning `404 Course not found.` handles both cases safely.

### Convert Empty Optional Strings To `null`

The UI may send empty strings for optional form fields.

The API stores those as `null` instead of whitespace or empty text.

### Archive Instead Of Deleting When Possible

The API supports deletion, but course history is usually better preserved by setting `isArchived` to `true`.

## Tests

The Stage 9B tests prove:

- Courses require authentication
- A signed-in student can create a course
- Course ownership uses the authenticated user's ID
- Optional empty fields become `null`
- Invalid create bodies return `400`
- Default listing returns active owned courses only
- Archived and all filters work
- Invalid filters return `400`
- A signed-in student can get one owned course
- Another student's course returns `404`
- A signed-in student can update a course
- Empty updates return `400`
- Invalid UUID params return `400`
- A signed-in student can delete an owned course

## Commands

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Manual create test:

```bash
curl -i -X POST http://127.0.0.1:4000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token-here" \
  -d '{"name":"Biology I","code":"BIO 101","color":"#10B981"}'
```

## Stage 9B Acceptance Criteria

Stage 9B is complete when:

- `GET /api/courses` exists
- `POST /api/courses` exists
- `GET /api/courses/:courseId` exists
- `PATCH /api/courses/:courseId` exists
- `DELETE /api/courses/:courseId` exists
- All course routes require authentication
- Course validation works
- Owner-scoped SQL prevents cross-user access
- Course route tests pass
- Existing auth and health tests still pass
- You approve moving to Stage 9C

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

Before Stage 9C, make sure you can answer these:

1. Why does `POST /api/courses` use `req.user.id` instead of a `userId` body field?
2. Why does another user's course return `404`?
3. Why do optional empty strings become `null`?
4. How does `PATCH` update only the fields the student sent?
