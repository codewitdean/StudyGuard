# Stage 10A: Coursework API Design

## Goal

The goal of Stage 10A is to design the Coursework API before we implement it.

Coursework is more complex than courses because each item can have a due date, course relationship, type, priority, difficulty, effort estimate, status, grade weight, topic, and notes.

This stage does not add route code yet. The implementation comes in Stage 10B.

## Why Coursework Comes Next

StudyGuard cannot plan realistic study time until it knows what work the student has to complete.

Courses organize the student's academic world. Coursework creates the actual deadlines and effort estimates that the scheduling engine will eventually use.

## Existing Database Table

The `coursework` table already exists from Stage 6.

Columns:

- `id`
- `user_id`
- `course_id`
- `title`
- `description`
- `type`
- `due_at`
- `priority`
- `difficulty`
- `estimated_minutes`
- `status`
- `grade_weight`
- `topic`
- `notes`
- `completed_at`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `title` is required
- `title` must be 1 to 200 characters after trimming
- `course_id` is optional
- `type` must be one of the allowed coursework types
- `priority` defaults to `medium`
- `difficulty` defaults to `medium`
- `estimated_minutes` defaults to `60` and must be greater than 0
- `status` defaults to `not_started`
- `grade_weight` must be between 0 and 100 if provided
- `topic` must be 1 to 120 characters after trimming if provided
- `updated_at` is handled by a database trigger

## Ownership Rules

The frontend must never send `user_id`.

The backend gets ownership from the verified token:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> coursework service uses req.user.id in SQL
```

Every coursework query must include `user_id = req.user.id`.

If a request includes `courseId`, the backend must also confirm that the course belongs to the same signed-in user before saving it.

That prevents a student from attaching coursework to another student's course by guessing or copying a UUID.

## Planned Endpoint Path

Use `/api/coursework` for this resource.

`coursework` is an uncountable word, so the path stays singular as a collection name.

## Planned Endpoints

### 1. List Coursework

```http
GET /api/coursework
```

Authentication required: yes.

Default behavior: return open coursework sorted by due date.

Open coursework means:

- `not_started`
- `in_progress`
- `postponed`

Optional query strings:

```http
GET /api/coursework?status=open
GET /api/coursework?status=completed
GET /api/coursework?status=all
GET /api/coursework?courseId=course-uuid
GET /api/coursework?type=assignment
GET /api/coursework?due=overdue
GET /api/coursework?sort=dueDate
```

Allowed `status` filter values:

- `open`
- `all`
- `not_started`
- `in_progress`
- `completed`
- `postponed`
- `missed`
- `archived`

Allowed `type` filter values:

- `assignment`
- `project`
- `quiz`
- `test`
- `exam`
- `reading`
- `study_task`

Allowed `due` filter values:

- `all`
- `upcoming`
- `overdue`
- `no_due_date`

Allowed `sort` values:

- `dueDate`
- `createdNewest`
- `effortHigh`

Success response:

```json
{
  "success": true,
  "data": {
    "coursework": [
      {
        "id": "coursework-id",
        "courseId": "course-id",
        "course": {
          "id": "course-id",
          "name": "Biology I",
          "code": "BIO 101",
          "color": "#10B981"
        },
        "title": "Biology lab report",
        "description": "Write the enzyme lab report.",
        "type": "assignment",
        "dueAt": "2027-02-16T02:00:00.000Z",
        "priority": "high",
        "difficulty": "hard",
        "estimatedMinutes": 180,
        "status": "not_started",
        "gradeWeight": 12.5,
        "topic": "Enzymes",
        "notes": "Start with data table cleanup.",
        "completedAt": null,
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ]
  }
}
```

Planned SQL shape:

```sql
SELECT coursework columns, course summary columns
FROM coursework
LEFT JOIN courses ON courses.id = coursework.course_id AND courses.user_id = coursework.user_id
WHERE coursework.user_id = $1
ORDER BY coursework.due_at ASC NULLS LAST, coursework.created_at DESC;
```

### 2. Create Coursework

```http
POST /api/coursework
```

Authentication required: yes.

Request body:

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

Validation rules:

- `courseId` is optional and can be `null`
- `courseId` must be a UUID if provided
- `title` is required
- `title` must be 1 to 200 characters after trimming
- `description` is optional and can become `null`
- `type` is required
- `dueAt` is optional and can become `null`
- `dueAt` must be a valid date-time string if provided
- `priority` is optional and defaults to `medium`
- `difficulty` is optional and defaults to `medium`
- `estimatedMinutes` is optional and defaults to `60`
- `estimatedMinutes` must be a positive integer
- `gradeWeight` is optional and can become `null`
- `gradeWeight` must be between 0 and 100 if provided
- `topic` is optional and can become `null`
- `notes` is optional and can become `null`

Empty optional strings should become `null` before reaching SQL.

If `courseId` is provided, the service must check that the course exists for the signed-in user before inserting.

Success status:

```text
201 Created
```

Planned SQL shape:

```sql
INSERT INTO coursework (user_id, course_id, title, description, type, due_at, priority, difficulty, estimated_minutes, grade_weight, topic, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING coursework columns;
```

### 3. Get One Coursework Item

```http
GET /api/coursework/:courseworkId
```

Authentication required: yes.

The coursework ID must be a UUID.

The lookup must include both `id` and `user_id`:

```sql
SELECT coursework columns, course summary columns
FROM coursework
LEFT JOIN courses ON courses.id = coursework.course_id AND courses.user_id = coursework.user_id
WHERE coursework.id = $1 AND coursework.user_id = $2;
```

If no row is found, return `404`.

Use `404` instead of `403` so the API does not reveal whether another student's coursework exists.

### 4. Update Coursework

```http
PATCH /api/coursework/:courseworkId
```

Authentication required: yes.

Request body can include any of these fields:

```json
{
  "courseId": "course-id-or-null",
  "title": "Biology lab report draft",
  "description": "Finish intro and methods.",
  "type": "assignment",
  "dueAt": "2027-02-16T02:00:00.000Z",
  "priority": "urgent",
  "difficulty": "hard",
  "estimatedMinutes": 210,
  "status": "in_progress",
  "gradeWeight": 12.5,
  "topic": "Enzymes",
  "notes": "Ask about graph format."
}
```

Validation rules:

- At least one field must be provided
- Provided fields follow the same rules as create
- `status` must be one of the allowed workflow states
- If `courseId` changes, the new course must belong to the signed-in user

Allowed `status` values:

- `not_started`
- `in_progress`
- `completed`
- `postponed`
- `missed`
- `archived`

Completion behavior:

- If status changes to `completed`, set `completed_at` to `now()`
- If status changes away from `completed`, clear `completed_at`
- Do not accept `completedAt` directly from the frontend in this first implementation

The update must be owner-scoped:

```sql
UPDATE coursework
SET ...
WHERE id = $1 AND user_id = $2
RETURNING coursework columns;
```

If no row is updated, return `404`.

### 5. Delete Coursework

```http
DELETE /api/coursework/:courseworkId
```

Authentication required: yes.

Deletion must be owner-scoped:

```sql
DELETE FROM coursework
WHERE id = $1 AND user_id = $2
RETURNING id;
```

If no row is deleted, return `404`.

Success status:

```text
204 No Content
```

## Response Shape

All successful JSON responses should follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors should follow:

```json
{
  "success": false,
  "error": {
    "message": "Something went wrong."
  }
}
```

## Error Decisions

### Missing Token

Status: `401 Unauthorized`

Message:

```text
Authentication required.
```

### Invalid Token

Status: `401 Unauthorized`

Message:

```text
Invalid or expired token.
```

### Invalid Body, Params, Or Query

Status: `400 Bad Request`

Message:

```text
Validation failed.
```

### Coursework Not Found Or Not Owned By User

Status: `404 Not Found`

Message:

```text
Coursework item not found.
```

### Course Not Found Or Not Owned By User

Status: `404 Not Found`

Message:

```text
Course not found.
```

## Date And Time Decision

The frontend should send `dueAt` as an ISO date-time string, such as:

```text
2027-02-16T02:00:00.000Z
```

PostgreSQL stores it as `TIMESTAMPTZ` in `due_at`.

This keeps the backend precise. Later, the frontend can format that timestamp into the student's local timezone for display.

## What We Are Not Building Yet

These are real features, but they should wait until basic coursework CRUD works:

- coursework dependencies
- syllabus upload extraction
- AI-generated coursework suggestions
- scheduling study blocks from coursework
- recommendation approval
- progress analytics

## Files We Will Add In Stage 10B

Planned backend files:

- `server/src/validators/courseworkValidators.js`
- `server/src/services/courseworkService.js`
- `server/src/controllers/courseworkController.js`
- `server/src/routes/courseworkRoutes.js`
- `server/tests/courseworkRoutes.test.js`

Planned existing files to update:

- `server/src/app.js` to mount `/api/coursework`
- `server/src/utils/httpErrors.js` only if another error helper becomes useful

## Planned Route Wiring

The route layer should look conceptually like this:

```text
router.get("/", requireAuth, validateRequest(listCourseworkSchema), asyncHandler(listCoursework));
router.post("/", requireAuth, validateRequest(createCourseworkSchema), asyncHandler(createCoursework));
router.get("/:courseworkId", requireAuth, validateRequest(courseworkIdSchema), asyncHandler(getCoursework));
router.patch("/:courseworkId", requireAuth, validateRequest(updateCourseworkSchema), asyncHandler(updateCoursework));
router.delete("/:courseworkId", requireAuth, validateRequest(courseworkIdSchema), asyncHandler(deleteCoursework));
```

## Planned Tests For Stage 10B

The implementation tests should prove:

- A signed-in student can create coursework without a course
- A signed-in student can create coursework for an owned course
- Another student's course cannot be attached
- Optional empty strings become `null`
- Invalid create bodies return `400`
- A signed-in student can list only their own coursework
- Course, type, status, due, and sort filters work
- A signed-in student can get one owned coursework item
- Another student's coursework returns `404`
- A signed-in student can update coursework fields
- Changing status to `completed` sets `completedAt`
- Changing status away from `completed` clears `completedAt`
- Empty updates return `400`
- Invalid UUID params return `400`
- A signed-in student can delete an owned coursework item
- Missing tokens return `401`
- Existing auth, health, and course tests still pass

## Request Flow Preview

Creating coursework will follow the same backend pattern as courses:

```text
Client
-> POST /api/coursework
-> requireAuth verifies JWT
-> validateRequest checks body
-> courseworkController.createCoursework
-> courseworkService.createCourseworkForUser
-> service confirms course ownership if courseId exists
-> SQL inserts coursework with req.user.id
-> controller returns 201 JSON
-> Client displays the coursework item
```

## Stage 10A Acceptance Criteria

Stage 10A is complete when:

- The Coursework API path is chosen
- CRUD endpoints are documented
- Request bodies are documented
- Query filters are documented
- Validation rules are documented
- Ownership rules are documented
- Course relationship rules are documented
- Completion status behavior is documented
- Stage 10B implementation files are identified
- You approve moving to Stage 10B

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

Before Stage 10B, make sure you can answer these:

1. Why does coursework need both `user_id` and optional `course_id`?
2. Why must the backend check course ownership before saving a `courseId`?
3. Why is `completedAt` controlled by the backend in this first version?
4. Why do we postpone coursework dependencies until after basic CRUD works?
