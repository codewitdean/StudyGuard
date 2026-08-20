# Stage 11B: Availability CRUD API Implementation

## Goal

The goal of Stage 11B is to implement the protected Availability API designed in Stage 11A.

Students can now create, list, view, update, and delete weekly study windows and one-time availability exceptions through authenticated backend routes.

This stage is backend-only. The browser UI for availability comes next in Stage 11C.

## Endpoints Added

All availability routes require a JWT bearer token.

Weekly availability windows:

```http
GET /api/availability/weekly
POST /api/availability/weekly
GET /api/availability/weekly/:availabilityWindowId
PATCH /api/availability/weekly/:availabilityWindowId
DELETE /api/availability/weekly/:availabilityWindowId
```

Availability exceptions:

```http
GET /api/availability/exceptions
POST /api/availability/exceptions
GET /api/availability/exceptions/:availabilityExceptionId
PATCH /api/availability/exceptions/:availabilityExceptionId
DELETE /api/availability/exceptions/:availabilityExceptionId
```

## Files Added Or Changed

### `server/src/validators/availabilityValidators.js`

Adds Zod schemas for availability requests.

The validators handle:

- weekly list query filters
- weekly create request bodies
- weekly update request bodies
- weekly UUID route params
- exception list query filters
- exception create request bodies
- exception update request bodies
- exception UUID route params
- `HH:mm` time validation
- `YYYY-MM-DD` date validation
- start-before-end validation
- full-day exception rules
- partial-day exception rules
- converting empty optional labels and reasons to `null`

### `server/src/services/availabilityService.js`

Contains the availability business logic and SQL.

It maps database rows from snake_case to API-friendly camelCase:

```text
start_time -> startTime
end_time -> endTime
exception_date -> exceptionDate
is_full_day -> isFullDay
created_at -> createdAt
updated_at -> updatedAt
```

It also formats PostgreSQL `TIME` values as `HH:mm` and exception `DATE` values as `YYYY-MM-DD`.

Every read, update, and delete query is scoped by the signed-in student's `userId`.

### `server/src/controllers/availabilityController.js`

Contains the HTTP controller functions for weekly windows and exceptions.

Controllers stay thin. They read validated data, call the service, and return JSON responses.

### `server/src/routes/availabilityRoutes.js`

Defines the protected Express router for `/api/availability`.

The router uses:

- `requireAuth` to verify the JWT
- `validateRequest` to validate params, query, and body data
- `asyncHandler` to send thrown errors to the shared error handler

### `server/src/app.js`

Mounts availability routes with:

```js
app.use("/api/availability", availabilityRoutes);
```

### `server/tests/availabilityRoutes.test.js`

Adds endpoint tests for the protected availability API.

## Response Shape

Weekly list responses use `weeklyAvailability`:

```json
{
  "success": true,
  "data": {
    "weeklyAvailability": []
  }
}
```

Single weekly window responses use `availabilityWindow`:

```json
{
  "success": true,
  "data": {
    "availabilityWindow": {
      "id": "availability-window-id",
      "weekday": 1,
      "startTime": "18:00",
      "endTime": "21:00"
    }
  }
}
```

Exception list responses use `availabilityExceptions`:

```json
{
  "success": true,
  "data": {
    "availabilityExceptions": []
  }
}
```

Single exception responses use `availabilityException`:

```json
{
  "success": true,
  "data": {
    "availabilityException": {
      "id": "availability-exception-id",
      "exceptionDate": "2027-02-17",
      "type": "extra_available"
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
-> availability controller passes req.user.id to the service
-> SQL uses user_id = req.user.id
```

This prevents one student from seeing or modifying another student's weekly windows or exceptions.

## Weekly Availability Flow

Creating a weekly availability window follows this backend path:

```text
Client
-> POST /api/availability/weekly
-> requireAuth
-> validateRequest(createWeeklyAvailabilitySchema)
-> availabilityController.createWeeklyAvailability
-> availabilityService.createWeeklyAvailabilityForUser
-> service checks for overlap
-> INSERT INTO weekly_availability with user_id from req.user.id
-> 201 response with the new availability window
```

## Weekly Window Conflict Rule

A weekly window cannot overlap another owned weekly window on the same weekday.

The service checks overlap with this shape:

```sql
WHERE user_id = $1
  AND weekday = $2
  AND start_time < new_end_time
  AND end_time > new_start_time
```

Adjacent windows are allowed. For example, `18:00-19:00` and `19:00-20:00` do not overlap.

Overlapping windows return `409 Conflict`.

## Availability Exception Flow

Creating an availability exception follows this backend path:

```text
Client
-> POST /api/availability/exceptions
-> requireAuth
-> validateRequest(createAvailabilityExceptionSchema)
-> availabilityController.createAvailabilityException
-> availabilityService.createAvailabilityExceptionForUser
-> service checks for date/time conflicts
-> INSERT INTO availability_exceptions with user_id from req.user.id
-> 201 response with the new availability exception
```

## Exception Shape Rules

Full-day exceptions use:

```json
{
  "exceptionDate": "2027-02-16",
  "type": "unavailable",
  "isFullDay": true,
  "reason": "Travel day"
}
```

Full-day exceptions store `startTime` and `endTime` as `null`.

Partial-day exceptions use:

```json
{
  "exceptionDate": "2027-02-17",
  "type": "extra_available",
  "isFullDay": false,
  "startTime": "14:00",
  "endTime": "16:00"
}
```

Partial-day exceptions require both `startTime` and `endTime`.

## Exception Conflict Rule

An exception cannot conflict with another owned exception on the same date.

Conflict cases include:

- a full-day exception already exists for that date
- creating a full-day exception when any exception already exists for that date
- overlapping partial-day exceptions on the same date

Adjacent partial-day exceptions are allowed. For example, `14:00-16:00` and `16:00-17:00` do not overlap.

Conflicting exceptions return `409 Conflict`.

## List Filters

Weekly availability supports:

```http
GET /api/availability/weekly?weekday=1
```

Availability exceptions support:

```http
GET /api/availability/exceptions?from=2027-02-01
GET /api/availability/exceptions?to=2027-02-28
GET /api/availability/exceptions?from=2027-02-01&to=2027-02-28
GET /api/availability/exceptions?type=extra_available
```

If both `from` and `to` are provided, `from` must be on or before `to`.

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

Weekly window missing or not owned by user:

```json
{
  "success": false,
  "error": {
    "message": "Availability window not found."
  }
}
```

Availability exception missing or not owned by user:

```json
{
  "success": false,
  "error": {
    "message": "Availability exception not found."
  }
}
```

Conflict responses use `409`:

```json
{
  "success": false,
  "error": {
    "message": "Availability window conflicts with an existing window."
  }
}
```

## Time And Date Choices

Weekly availability uses `TIME` values and returns them as `HH:mm`.

Availability exceptions use `DATE` values and returns them as `YYYY-MM-DD`.

The backend does not convert these values to UTC in this stage because availability represents the student's local routine.

## Tests

The Stage 11B tests prove:

- Availability routes require authentication
- A signed-in student can create a weekly window
- Optional weekly labels become `null`
- Invalid weekly window bodies return `400`
- Invalid weekly filters return `400`
- Duplicate or overlapping weekly windows return `409`
- Adjacent weekly windows are allowed
- A signed-in student can list only their own weekly windows
- Weekday filtering works
- A signed-in student can get one owned weekly window
- Another student's weekly window returns `404`
- A signed-in student can update a weekly window
- Updating a weekly window cannot create an overlap
- Empty weekly updates return `400`
- Invalid weekly UUID params return `400`
- A signed-in student can delete an owned weekly window
- A signed-in student can create a full-day exception
- A signed-in student can create a partial-day exception
- Optional exception reasons become `null`
- Invalid exception bodies return `400`
- Invalid exception filters return `400`
- Conflicting exceptions return `409`
- Adjacent partial-day exceptions are allowed
- A signed-in student can list only their own exceptions
- Date and type filters work
- A signed-in student can get one owned exception
- Another student's exception returns `404`
- A signed-in student can update an exception
- Updating an exception can clear times for full-day exceptions
- Updating an exception cannot create an overlap
- Empty exception updates return `400`
- Invalid exception UUID params return `400`
- A signed-in student can delete an owned exception
- Existing auth, health, course, and coursework tests still pass

## Commands

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Manual weekly create test:

```bash
curl -i -X POST http://127.0.0.1:4000/api/availability/weekly \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token-here" \
  -d '{"weekday":1,"startTime":"18:00","endTime":"21:00","label":"Library time"}'
```

Manual exception create test:

```bash
curl -i -X POST http://127.0.0.1:4000/api/availability/exceptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token-here" \
  -d '{"exceptionDate":"2027-02-17","type":"extra_available","startTime":"14:00","endTime":"16:00"}'
```

## Stage 11B Acceptance Criteria

Stage 11B is complete when:

- `GET /api/availability/weekly` exists
- `POST /api/availability/weekly` exists
- `GET /api/availability/weekly/:availabilityWindowId` exists
- `PATCH /api/availability/weekly/:availabilityWindowId` exists
- `DELETE /api/availability/weekly/:availabilityWindowId` exists
- `GET /api/availability/exceptions` exists
- `POST /api/availability/exceptions` exists
- `GET /api/availability/exceptions/:availabilityExceptionId` exists
- `PATCH /api/availability/exceptions/:availabilityExceptionId` exists
- `DELETE /api/availability/exceptions/:availabilityExceptionId` exists
- All availability routes require authentication
- Weekly validation works
- Exception validation works
- Owner-scoped SQL prevents cross-user access
- Weekly overlap checks return `409`
- Exception conflict checks return `409`
- Availability route tests pass
- Existing auth, health, course, and coursework tests still pass
- You approve moving to Stage 11C

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

Before Stage 11C, make sure you can answer these:

1. Why do weekly windows reject overlaps but allow adjacent windows?
2. Why do full-day exceptions clear `startTime` and `endTime`?
3. Why do another student's availability records return `404`?
4. Why does the service fetch the current record before applying partial updates?
