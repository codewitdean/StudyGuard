# Stage 9C: Frontend Course Management

## Goal

The goal of Stage 9C is to connect the React frontend to the protected Courses API from Stage 9B.

A signed-in student can now manage courses in the browser instead of only through backend tests or curl.

The frontend can:

- Load active, archived, or all courses
- Create a course
- Edit a course
- Archive a course
- Restore an archived course
- Delete a course
- Show validation and API errors
- Sign the student out if their token expires

## Files Added or Changed

### `client/src/api/authApi.js`

Exports the shared `requestJson` helper so other frontend API modules can reuse the same fetch and error-handling behavior.

It also now handles `204 No Content` responses by returning `null` instead of expecting JSON data.

### `client/src/api/courseApi.js`

Adds frontend API functions for courses:

- `listCourses`
- `createCourse`
- `updateCourse`
- `deleteCourse`

Each function sends the JWT as:

```http
Authorization: Bearer <token>
```

### `client/src/components/CourseManagement.jsx`

Adds the signed-in course management workspace.

It contains:

- course form state
- create and edit form handling
- course list loading
- active, archived, and all filters
- archive and restore actions
- delete action
- loading states
- API error states

### `client/src/App.jsx`

Connects the Courses workspace to the signed-in app shell.

The sidebar now switches between:

- `Dashboard`
- `Courses`

Other navigation items are visible but disabled until their stages are built.

## Frontend Request Flow

Creating a course now follows this browser-to-backend path:

```text
Student fills course form
-> CourseManagement handles submit
-> createCourse calls requestJson
-> fetch POST /api/courses
-> Authorization header sends JWT
-> backend verifies token and validates body
-> backend inserts course owned by req.user.id
-> frontend reloads the course list
```

## Course Form Fields

The frontend form sends:

- `name`
- `code`
- `instructor`
- `color`
- `term`
- `targetGrade`

The backend still owns final validation. The frontend makes the form pleasant to use, but the server remains the source of truth.

## Course List Filters

The Courses view can request:

```http
GET /api/courses?status=active
GET /api/courses?status=archived
GET /api/courses?status=all
```

The default view is active courses.

## Why The Token Still Matters

Courses are private data.

Every course request uses the stored auth token. The backend gets the user ID from that verified token and scopes SQL to the signed-in student.

The frontend never sends `user_id` when creating or changing a course.

## Error Handling

If the backend returns validation errors, the UI shows the first message and lists additional field messages when available.

If the backend returns `401`, the frontend clears the saved token and sends the student back to the auth screen.

## Why We Still Use Plain Fetch

This stage intentionally keeps data fetching simple.

We are still learning the direct browser flow:

```text
form state -> fetch -> backend -> response state -> UI update
```

TanStack Query can come later, after the plain fetch lifecycle is comfortable.

## Commands

Run the backend:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev JWT_SECRET=replace-with-a-long-random-secret npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Build the frontend:

```bash
npm run build --workspace client
```

## Stage 9C Acceptance Criteria

Stage 9C is complete when:

- Signed-in users can open the Courses view
- The frontend can list courses from `GET /api/courses`
- The frontend can create courses with `POST /api/courses`
- The frontend can edit courses with `PATCH /api/courses/:courseId`
- The frontend can archive and restore courses
- The frontend can delete courses with `DELETE /api/courses/:courseId`
- Course requests include the stored JWT
- API validation errors appear in the UI
- Expired sessions clear the token
- Frontend build passes
- Existing backend tests still pass
- You approve moving to Stage 10A

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

Before Stage 10A, make sure you can answer these:

1. Why does the frontend send a token with every course request?
2. Why does the backend still validate course data even though the frontend has form fields?
3. Why does deleting a course use `204 No Content`?
4. Why are disabled sidebar items still visible?
