# Stage 11A: Availability API Design

## Goal

The goal of Stage 11A is to design the Availability API before we implement it.

Availability tells StudyGuard when a student can realistically study. Coursework tells the app what needs to be done; availability tells it when that work can fit.

This stage does not add route code yet. The implementation comes in Stage 11B.

## Why Availability Comes Next

StudyGuard now has accounts, courses, and coursework. The next scheduling ingredient is time.

A useful study plan needs two kinds of availability data:

- reusable weekly study windows
- one-time changes for specific dates

Weekly windows describe the normal routine. Exceptions describe real life when the normal routine changes.

## Existing Database Tables

The availability tables already exist from Stage 6.

### `weekly_availability`

Columns:

- `id`
- `user_id`
- `weekday`
- `start_time`
- `end_time`
- `label`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `weekday` must be between `1` and `7`
- `1` means Monday and `7` means Sunday
- `start_time` is required
- `end_time` is required
- `start_time` must be before `end_time`
- `label` is optional and must be 1 to 80 characters after trimming if provided
- the exact same user, weekday, start time, and end time cannot be duplicated
- `updated_at` is handled by a database trigger

### `availability_exceptions`

Columns:

- `id`
- `user_id`
- `exception_date`
- `type`
- `is_full_day`
- `start_time`
- `end_time`
- `reason`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `exception_date` is required
- `type` must be `unavailable` or `extra_available`
- `is_full_day` defaults to `false`
- full-day exceptions must not have `start_time` or `end_time`
- partial-day exceptions must have `start_time` and `end_time`
- partial-day `start_time` must be before `end_time`
- `reason` is optional and must be 1 to 160 characters after trimming if provided
- `updated_at` is handled by a database trigger

## Ownership Rules

The frontend must never send `user_id`.

The backend gets ownership from the verified token:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> availability service uses req.user.id in SQL
```

Every availability query must include `user_id = req.user.id`.

A student should never be able to see, edit, or delete another student's availability.

## Planned Endpoint Path

Use `/api/availability` for this feature area.

Weekly windows and exceptions are separate child resources:

```http
/api/availability/weekly
/api/availability/exceptions
```

This keeps the API readable while making it clear that both resources feed the same scheduling feature.

## Weekly Availability Endpoints

### 1. List Weekly Windows

```http
GET /api/availability/weekly
```

Authentication required: yes.

Default behavior: return all weekly windows owned by the signed-in student, sorted by weekday and start time.

Optional query string:

```http
GET /api/availability/weekly?weekday=1
```

Allowed `weekday` values: `1` through `7`.

Success response:

```json
{
  "success": true,
  "data": {
    "weeklyAvailability": [
      {
        "id": "availability-window-id",
        "weekday": 1,
        "startTime": "18:00",
        "endTime": "21:00",
        "label": "Library time",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ]
  }
}
```

Planned SQL shape:

```sql
SELECT weekly availability columns
FROM weekly_availability
WHERE user_id = $1
ORDER BY weekday ASC, start_time ASC;
```

### 2. Create Weekly Window

```http
POST /api/availability/weekly
```

Authentication required: yes.

Request body:

```json
{
  "weekday": 1,
  "startTime": "18:00",
  "endTime": "21:00",
  "label": "Library time"
}
```

Validation rules:

- `weekday` is required
- `weekday` must be an integer from `1` to `7`
- `startTime` is required
- `endTime` is required
- time values should use `HH:mm`
- `startTime` must be before `endTime`
- `label` is optional and can become `null`
- empty optional strings should become `null` before reaching SQL

Business rule: a weekly window must not overlap another weekly window for the same user and weekday.

Overlap check shape:

```sql
SELECT id
FROM weekly_availability
WHERE user_id = $1
  AND weekday = $2
  AND start_time < $4::time
  AND end_time > $3::time;
```

Success status:

```text
201 Created
```

### 3. Get One Weekly Window

```http
GET /api/availability/weekly/:availabilityWindowId
```

Authentication required: yes.

The availability window ID must be a UUID.

The lookup must include both `id` and `user_id`:

```sql
SELECT weekly availability columns
FROM weekly_availability
WHERE id = $1 AND user_id = $2;
```

If no row is found, return `404`.

### 4. Update Weekly Window

```http
PATCH /api/availability/weekly/:availabilityWindowId
```

Authentication required: yes.

Request body can include any of these fields:

```json
{
  "weekday": 2,
  "startTime": "17:30",
  "endTime": "19:30",
  "label": "After work"
}
```

Validation rules:

- at least one field must be provided
- provided fields follow the same rules as create
- if changing time or weekday, the updated window must not overlap another owned window

The update must be owner-scoped:

```sql
UPDATE weekly_availability
SET ...
WHERE id = $1 AND user_id = $2
RETURNING weekly availability columns;
```

If no row is updated, return `404`.

### 5. Delete Weekly Window

```http
DELETE /api/availability/weekly/:availabilityWindowId
```

Authentication required: yes.

Deletion must be owner-scoped:

```sql
DELETE FROM weekly_availability
WHERE id = $1 AND user_id = $2
RETURNING id;
```

If no row is deleted, return `404`.

Success status:

```text
204 No Content
```

## Availability Exception Endpoints

Stage 11B supports one exception date per row. A future frontend can create several rows when the student selects a date range.

### 1. List Exceptions

```http
GET /api/availability/exceptions
```

Authentication required: yes.

Default behavior: return all exceptions owned by the signed-in student, sorted by date and start time.

Optional query strings:

```http
GET /api/availability/exceptions?from=2027-02-01
GET /api/availability/exceptions?to=2027-02-28
GET /api/availability/exceptions?from=2027-02-01&to=2027-02-28
GET /api/availability/exceptions?type=unavailable
```

Allowed `type` filter values:

- `all`
- `unavailable`
- `extra_available`

Date filter rules:

- `from` must be a `YYYY-MM-DD` date if provided
- `to` must be a `YYYY-MM-DD` date if provided
- if both are provided, `from` must be on or before `to`

Success response:

```json
{
  "success": true,
  "data": {
    "availabilityExceptions": [
      {
        "id": "availability-exception-id",
        "exceptionDate": "2027-02-16",
        "type": "unavailable",
        "isFullDay": false,
        "startTime": "18:00",
        "endTime": "21:00",
        "reason": "Work shift",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ]
  }
}
```

Planned SQL shape:

```sql
SELECT availability exception columns
FROM availability_exceptions
WHERE user_id = $1
ORDER BY exception_date ASC, is_full_day DESC, start_time ASC NULLS FIRST;
```

### 2. Create Exception

```http
POST /api/availability/exceptions
```

Authentication required: yes.

Full-day unavailable request body:

```json
{
  "exceptionDate": "2027-02-16",
  "type": "unavailable",
  "isFullDay": true,
  "reason": "Travel day"
}
```

Partial extra-available request body:

```json
{
  "exceptionDate": "2027-02-17",
  "type": "extra_available",
  "isFullDay": false,
  "startTime": "14:00",
  "endTime": "16:00",
  "reason": "Class cancelled"
}
```

Validation rules:

- `exceptionDate` is required
- `exceptionDate` must be a `YYYY-MM-DD` date
- `type` is required
- `type` must be `unavailable` or `extra_available`
- `isFullDay` is optional and defaults to `false`
- full-day exceptions must not include `startTime` or `endTime`
- partial-day exceptions must include `startTime` and `endTime`
- partial-day time values should use `HH:mm`
- partial-day `startTime` must be before `endTime`
- `reason` is optional and can become `null`
- empty optional strings should become `null` before reaching SQL

Business rule: an exception must not conflict with another owned exception on the same date.

Conflict examples:

- a full-day exception already exists for that date
- creating a full-day exception when any exception already exists for that date
- a partial-day exception overlaps another partial-day exception on that date

Success status:

```text
201 Created
```

### 3. Get One Exception

```http
GET /api/availability/exceptions/:availabilityExceptionId
```

Authentication required: yes.

The availability exception ID must be a UUID.

The lookup must include both `id` and `user_id`:

```sql
SELECT availability exception columns
FROM availability_exceptions
WHERE id = $1 AND user_id = $2;
```

If no row is found, return `404`.

### 4. Update Exception

```http
PATCH /api/availability/exceptions/:availabilityExceptionId
```

Authentication required: yes.

Request body can include any of these fields:

```json
{
  "exceptionDate": "2027-02-17",
  "type": "extra_available",
  "isFullDay": false,
  "startTime": "15:00",
  "endTime": "17:00",
  "reason": "Class cancelled"
}
```

Validation rules:

- at least one field must be provided
- provided fields follow the same rules as create
- the final exception shape must satisfy the full-day or partial-day rules
- if changing date or time, the updated exception must not conflict with another owned exception

The update must be owner-scoped:

```sql
UPDATE availability_exceptions
SET ...
WHERE id = $1 AND user_id = $2
RETURNING availability exception columns;
```

If no row is updated, return `404`.

### 5. Delete Exception

```http
DELETE /api/availability/exceptions/:availabilityExceptionId
```

Authentication required: yes.

Deletion must be owner-scoped:

```sql
DELETE FROM availability_exceptions
WHERE id = $1 AND user_id = $2
RETURNING id;
```

If no row is deleted, return `404`.

Success status:

```text
204 No Content
```

## Time And Date Decisions

Weekly availability uses local wall-clock times.

The frontend should send `startTime` and `endTime` as `HH:mm`, such as:

```text
18:00
21:00
```

PostgreSQL stores these as `TIME`.

Do not convert weekly availability times to UTC. Monday 6 PM should stay Monday 6 PM for the student.

Availability exceptions use `exceptionDate` as `YYYY-MM-DD`, stored as `DATE`.

A later stage can add a timezone preference to the student profile before generating study plans across real calendar dates.

## Response Shape

All successful JSON responses should follow:

```json
{
  "success": true,
  "data": {}
}
```

Weekly list responses should use `weeklyAvailability`.

Single weekly window responses should use `availabilityWindow`.

Exception list responses should use `availabilityExceptions`.

Single exception responses should use `availabilityException`.

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

### Weekly Window Not Found Or Not Owned By User

Status: `404 Not Found`

Message:

```text
Availability window not found.
```

### Exception Not Found Or Not Owned By User

Status: `404 Not Found`

Message:

```text
Availability exception not found.
```

### Weekly Window Conflict

Status: `409 Conflict`

Message:

```text
Availability window conflicts with an existing window.
```

### Exception Conflict

Status: `409 Conflict`

Message:

```text
Availability exception conflicts with an existing exception.
```

## What We Are Not Building Yet

These are real features, but they should wait until basic availability CRUD works:

- resolved daily availability calendars
- multi-day exception creation
- timezone profile settings
- calendar imports
- automatic study plan generation
- conflict visualization in the UI

## Files We Will Add In Stage 11B

Planned backend files:

- `server/src/validators/availabilityValidators.js`
- `server/src/services/availabilityService.js`
- `server/src/controllers/availabilityController.js`
- `server/src/routes/availabilityRoutes.js`
- `server/tests/availabilityRoutes.test.js`

Planned existing files to update:

- `server/src/app.js` to mount `/api/availability`
- `server/src/utils/httpErrors.js` only if another error helper becomes useful

## Planned Route Wiring

The route layer should look conceptually like this:

```text
router.use(requireAuth);
router.get("/weekly", validateRequest(listWeeklyAvailabilitySchema), asyncHandler(listWeeklyAvailability));
router.post("/weekly", validateRequest(createWeeklyAvailabilitySchema), asyncHandler(createWeeklyAvailability));
router.get("/weekly/:availabilityWindowId", validateRequest(availabilityWindowIdSchema), asyncHandler(getWeeklyAvailability));
router.patch("/weekly/:availabilityWindowId", validateRequest(updateWeeklyAvailabilitySchema), asyncHandler(updateWeeklyAvailability));
router.delete("/weekly/:availabilityWindowId", validateRequest(availabilityWindowIdSchema), asyncHandler(deleteWeeklyAvailability));
router.get("/exceptions", validateRequest(listAvailabilityExceptionsSchema), asyncHandler(listAvailabilityExceptions));
router.post("/exceptions", validateRequest(createAvailabilityExceptionSchema), asyncHandler(createAvailabilityException));
router.get("/exceptions/:availabilityExceptionId", validateRequest(availabilityExceptionIdSchema), asyncHandler(getAvailabilityException));
router.patch("/exceptions/:availabilityExceptionId", validateRequest(updateAvailabilityExceptionSchema), asyncHandler(updateAvailabilityException));
router.delete("/exceptions/:availabilityExceptionId", validateRequest(availabilityExceptionIdSchema), asyncHandler(deleteAvailabilityException));
```

## Planned Tests For Stage 11B

The implementation tests should prove:

- availability routes require authentication
- a signed-in student can create a weekly window
- optional weekly labels become `null`
- invalid weekly window bodies return `400`
- duplicate or overlapping weekly windows return `409`
- a signed-in student can list only their own weekly windows
- weekday filtering works
- a signed-in student can get one owned weekly window
- another student's weekly window returns `404`
- a signed-in student can update a weekly window
- updating a weekly window cannot create an overlap
- empty weekly updates return `400`
- invalid weekly UUID params return `400`
- a signed-in student can delete an owned weekly window
- a signed-in student can create a full-day exception
- a signed-in student can create a partial-day exception
- optional exception reasons become `null`
- invalid exception bodies return `400`
- conflicting exceptions return `409`
- a signed-in student can list only their own exceptions
- date and type filters work
- a signed-in student can get one owned exception
- another student's exception returns `404`
- a signed-in student can update an exception
- empty exception updates return `400`
- invalid exception UUID params return `400`
- a signed-in student can delete an owned exception
- existing auth, health, course, and coursework tests still pass

## Request Flow Preview

Creating a weekly availability window will follow this backend pattern:

```text
Client
-> POST /api/availability/weekly
-> requireAuth verifies JWT
-> validateRequest checks body
-> availabilityController.createWeeklyAvailability
-> availabilityService.createWeeklyAvailabilityForUser
-> service checks for overlap
-> SQL inserts weekly window with req.user.id
-> controller returns 201 JSON
-> Client displays the weekly window
```

Creating an availability exception will follow this backend pattern:

```text
Client
-> POST /api/availability/exceptions
-> requireAuth verifies JWT
-> validateRequest checks body
-> availabilityController.createAvailabilityException
-> availabilityService.createAvailabilityExceptionForUser
-> service checks for date/time conflicts
-> SQL inserts exception with req.user.id
-> controller returns 201 JSON
-> Client displays the exception
```

## Stage 11A Acceptance Criteria

Stage 11A is complete when:

- The Availability API path is chosen
- Weekly availability endpoints are documented
- Availability exception endpoints are documented
- Request bodies are documented
- Query filters are documented
- Validation rules are documented
- Ownership rules are documented
- Time and date decisions are documented
- Conflict rules are documented
- Stage 11B implementation files are identified
- You approve moving to Stage 11B

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

Before Stage 11B, make sure you can answer these:

1. Why do weekly availability windows use local `TIME` values instead of UTC timestamps?
2. Why do availability exceptions need full-day and partial-day rules?
3. Why should overlapping availability windows return `409 Conflict`?
4. Why do all availability queries still need `user_id = req.user.id`?
