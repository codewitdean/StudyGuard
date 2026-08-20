# Stage 10C: Frontend Coursework Management

## Goal

The goal of Stage 10C is to connect the React frontend to the protected Coursework API from Stage 10B.

A signed-in student can now manage coursework in the browser instead of only through backend tests or curl.

The frontend can:

- Load coursework from the backend
- Filter coursework by status, course, type, due state, and sort order
- Create coursework with or without a course
- Edit coursework fields
- Mark coursework complete
- Reopen completed coursework
- Archive and restore coursework
- Delete coursework
- Show validation and API errors
- Sign the student out if their token expires

## Files Added Or Changed

### `client/src/api/courseworkApi.js`

Adds frontend API functions for coursework:

- `listCoursework`
- `createCoursework`
- `getCoursework`
- `updateCoursework`
- `deleteCoursework`

Each function sends the JWT as:

```http
Authorization: Bearer <token>
```

The list helper builds query strings for:

- `status`
- `courseId`
- `type`
- `due`
- `sort`

### `client/src/components/CourseworkManagement.jsx`

Adds the signed-in coursework management workspace.

It contains:

- coursework form state
- create and edit form handling
- course dropdown loading
- coursework list loading
- status, course, type, due, and sort filters
- complete, reopen, archive, restore, and delete actions
- loading states
- API error states

### `client/src/App.jsx`

Connects the Coursework workspace to the signed-in app shell.

The sidebar now switches between:

- `Dashboard`
- `Courses`
- `Coursework`

Other navigation items are visible but disabled until their stages are built.

## Frontend Request Flow

Creating coursework now follows this browser-to-backend path:

```text
Student fills coursework form
-> CourseworkManagement handles submit
-> createCoursework calls requestJson
-> fetch POST /api/coursework
-> Authorization header sends JWT
-> backend verifies token and validates body
-> backend checks course ownership if courseId exists
-> backend inserts coursework owned by req.user.id
-> frontend reloads the coursework list
```

## Coursework Form Fields

The frontend form sends:

- `courseId`
- `title`
- `description`
- `type`
- `dueAt`
- `priority`
- `difficulty`
- `estimatedMinutes`
- `gradeWeight`
- `topic`
- `notes`

When editing, the form also sends `status`.

The frontend converts the browser `datetime-local` value into an ISO string before sending `dueAt`.

The backend still owns final validation. The frontend makes the form pleasant to use, but the server remains the source of truth.

## Course Dropdown

The coursework screen loads owned courses with:

```http
GET /api/courses?status=all
```

That lets a student attach coursework to a course, and it also lets the edit form preserve older coursework that belongs to an archived course.

A coursework item can still use `No course` for personal study tasks.

## Coursework List Filters

The Coursework view can request:

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

The default view is open coursework sorted by due date.

## Quick Status Actions

The list includes common workflow actions:

- `Complete` changes status to `completed`
- `Reopen` changes status back to `in_progress`
- `Archive` changes status to `archived`
- `Restore` changes status back to `not_started`

The backend controls `completedAt`, so the frontend only sends the status change.

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

## Stage 10C Acceptance Criteria

Stage 10C is complete when:

- Signed-in users can open the Coursework view
- The frontend can list coursework from `GET /api/coursework`
- The frontend can create coursework with `POST /api/coursework`
- The frontend can edit coursework with `PATCH /api/coursework/:courseworkId`
- The frontend can complete and reopen coursework
- The frontend can archive and restore coursework
- The frontend can delete coursework with `DELETE /api/coursework/:courseworkId`
- Coursework requests include the stored JWT
- API validation errors appear in the UI
- Expired sessions clear the token
- Frontend build passes
- Existing backend tests still pass
- You approve moving to Stage 11A

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

Before Stage 11A, make sure you can answer these:

1. Why does the Coursework screen load courses before rendering the course dropdown?
2. Why does the frontend convert `datetime-local` values into ISO strings?
3. Why does completing coursework only send a `status` change?
4. Why does the backend still validate coursework even though the frontend form uses select fields?
