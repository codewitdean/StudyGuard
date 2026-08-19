# Stage 9A: Courses API Design

## Goal

The goal of Stage 9A is to design the Courses API before we implement it.

Courses are the first private resource after authentication. That makes this stage important because every course must belong to exactly one signed-in student.

This stage does not add route code yet. The implementation comes in Stage 9B.

## Why Courses Come Next

Coursework needs a course so StudyGuard can group assignments, exams, readings, study sessions, grades, and recommendations by class.

A course is simpler than coursework, so it is the right first protected CRUD resource.

CRUD means:

- Create
- Read
- Update
- Delete

## Existing Database Table

The `courses` table already exists from Stage 6.

Columns:

- `id`
- `user_id`
- `name`
- `code`
- `instructor`
- `color`
- `term`
- `target_grade`
- `is_archived`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `name` is required
- `name` must be 1 to 160 characters after trimming
- `code` can be empty in the UI, but should become `NULL` in the database
- `color` must look like `#10B981` if provided
- `is_archived` defaults to `false`
- `updated_at` is handled by a database trigger

## Ownership Rule

The browser must never send `user_id` for course ownership.

Instead, every protected route gets the user ID from the verified JWT:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> course service uses req.user.id in SQL
```

This prevents a student from creating or changing a course for another student by changing request JSON.

## Planned Endpoints

### 1. List Courses

```http
GET /api/courses
```

Authentication required: yes.

Default behavior: return active courses only.

Optional query string:

```http
GET /api/courses?status=active
GET /api/courses?status=archived
GET /api/courses?status=all
```

Allowed `status` values:

- `active`
- `archived`
- `all`

Success response:

```json
{
  "success": true,
  "data": {
    "courses": [
      {
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
    ]
  }
}
```

Planned SQL shape:

```sql
SELECT id, name, code, instructor, color, term, target_grade, is_archived, created_at, updated_at
FROM courses
WHERE user_id = $1
ORDER BY is_archived ASC, name ASC, created_at DESC;
```

If `status=active`, add:

```sql
AND is_archived = false
```

If `status=archived`, add:

```sql
AND is_archived = true
```

### 2. Create Course

```http
POST /api/courses
```

Authentication required: yes.

Request body:

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

Validation rules:

- `name` is required
- `name` must be 1 to 160 characters after trimming
- `code` is optional
- `code` must be 1 to 40 characters after trimming if provided
- `instructor` is optional
- `instructor` must be 1 to 120 characters after trimming if provided
- `color` is optional
- `color` must be a hex color like `#10B981` if provided
- `term` is optional
- `term` must be 1 to 80 characters after trimming if provided
- `targetGrade` is optional
- `targetGrade` must be 1 to 20 characters after trimming if provided

Empty optional strings should become `null` before reaching SQL.

Success status:

```text
201 Created
```

Planned SQL shape:

```sql
INSERT INTO courses (user_id, name, code, instructor, color, term, target_grade)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, name, code, instructor, color, term, target_grade, is_archived, created_at, updated_at;
```

### 3. Get One Course

```http
GET /api/courses/:courseId
```

Authentication required: yes.

The course ID must be a UUID.

The lookup must include both `id` and `user_id`:

```sql
SELECT id, name, code, instructor, color, term, target_grade, is_archived, created_at, updated_at
FROM courses
WHERE id = $1 AND user_id = $2;
```

If no row is found, return `404`.

We use `404` instead of `403` so the API does not reveal whether another student's course exists.

### 4. Update Course

```http
PATCH /api/courses/:courseId
```

Authentication required: yes.

Request body can include any of these fields:

```json
{
  "name": "Biology Lab",
  "code": "BIO 101L",
  "instructor": "Dr. Rivera",
  "color": "#2563EB",
  "term": "Spring 2027",
  "targetGrade": "A",
  "isArchived": true
}
```

Validation rules:

- At least one field must be provided
- Provided string fields follow the same rules as create
- `isArchived` must be a boolean if provided

The update must be owner-scoped:

```sql
UPDATE courses
SET ...
WHERE id = $1 AND user_id = $2
RETURNING id, name, code, instructor, color, term, target_grade, is_archived, created_at, updated_at;
```

If no row is updated, return `404`.

### 5. Delete Course

```http
DELETE /api/courses/:courseId
```

Authentication required: yes.

Deletion must be owner-scoped:

```sql
DELETE FROM courses
WHERE id = $1 AND user_id = $2
RETURNING id;
```

If no row is deleted, return `404`.

Success status:

```text
204 No Content
```

Important database behavior:

- Deleting a course does not delete the student's account
- Future coursework linked to this course will keep existing but lose the `course_id` link because the schema uses `ON DELETE SET NULL`
- Archiving is usually safer than deleting when the student may want history later

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

Status:

```text
401 Unauthorized
```

Message:

```text
Authentication required.
```

### Invalid Token

Status:

```text
401 Unauthorized
```

Message:

```text
Invalid or expired token.
```

### Invalid Body, Params, Or Query

Status:

```text
400 Bad Request
```

Message:

```text
Validation failed.
```

### Course Not Found Or Not Owned By User

Status:

```text
404 Not Found
```

Message:

```text
Course not found.
```

## Files We Will Add In Stage 9B

Planned backend files:

- `server/src/validators/courseValidators.js`
- `server/src/services/courseService.js`
- `server/src/controllers/courseController.js`
- `server/src/routes/courseRoutes.js`
- `server/tests/courseRoutes.test.js`

Planned existing files to update:

- `server/src/app.js` to mount `/api/courses`
- `server/src/utils/httpErrors.js` if we need a `notFound` helper

## Planned Route Wiring

The route layer should look conceptually like this:

```text
router.get("/", requireAuth, validateRequest(listCoursesSchema), asyncHandler(listCourses));
router.post("/", requireAuth, validateRequest(createCourseSchema), asyncHandler(createCourse));
router.get("/:courseId", requireAuth, validateRequest(courseIdSchema), asyncHandler(getCourse));
router.patch("/:courseId", requireAuth, validateRequest(updateCourseSchema), asyncHandler(updateCourse));
router.delete("/:courseId", requireAuth, validateRequest(courseIdSchema), asyncHandler(deleteCourse));
```

## Planned Tests For Stage 9B

The implementation tests should prove:

- A signed-in student can create a course
- The API trims string fields
- Empty optional fields become `null`
- A signed-in student can list only their own courses
- `status=active` returns active courses
- `status=archived` returns archived courses
- A signed-in student can get one owned course
- A signed-in student can update one owned course
- A signed-in student can archive and unarchive a course with `isArchived`
- A signed-in student can delete one owned course
- Missing tokens return `401`
- Invalid body values return `400`
- Invalid UUID params return `400`
- Another student's course returns `404`

## Request Flow Preview

Creating a course will follow the backend pattern we have been building:

```text
Client
-> POST /api/courses
-> requireAuth verifies JWT
-> validateRequest checks the body
-> courseController.createCourse
-> courseService.createCourse
-> SQL inserts course with req.user.id
-> controller returns 201 JSON
-> Client displays the course
```

## Stage 9A Acceptance Criteria

Stage 9A is complete when:

- The Courses API endpoints are chosen
- Request bodies are documented
- Validation rules are documented
- Ownership rules are documented
- Error responses are documented
- Stage 9B implementation files are identified
- You approve moving to Stage 9B

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
- Stage 9B: Courses CRUD API implementation - not started

## Understanding Check

Before Stage 9B, make sure you can answer these:

1. Why should the frontend never send `user_id` when creating a course?
2. Why do `GET`, `PATCH`, and `DELETE` course queries include both `id` and `user_id`?
3. Why is archiving often safer than deleting a course?
4. Why should another student's course return `404` instead of `403`?
