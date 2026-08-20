# Stage 11C: Frontend Availability Management

## Goal

The goal of Stage 11C is to connect the React frontend to the protected Availability API from Stage 11B.

A signed-in student can now manage reusable weekly study windows and one-time availability changes in the browser instead of only through backend tests or curl.

The frontend can:

- Load weekly availability windows
- Filter weekly windows by weekday
- Create weekly study windows
- Edit weekly study windows
- Delete weekly study windows
- Load one-time availability exceptions
- Filter exceptions by date range and type
- Create full-day and partial-day exceptions
- Edit availability exceptions
- Delete availability exceptions
- Show validation and API errors
- Sign the student out if their token expires

## Files Added Or Changed

### `client/src/api/availabilityApi.js`

Adds frontend API functions for availability:

- `listWeeklyAvailability`
- `createWeeklyAvailability`
- `getWeeklyAvailability`
- `updateWeeklyAvailability`
- `deleteWeeklyAvailability`
- `listAvailabilityExceptions`
- `createAvailabilityException`
- `getAvailabilityException`
- `updateAvailabilityException`
- `deleteAvailabilityException`

Each function sends the JWT as:

```http
Authorization: Bearer <token>
```

The list helpers build query strings for:

- weekly `weekday`
- exception `from`
- exception `to`
- exception `type`

### `client/src/components/AvailabilityManagement.jsx`

Adds the signed-in availability management workspace.

It contains:

- weekly form state
- weekly create and edit handling
- weekly list loading
- weekday filtering
- exception form state
- full-day exception handling
- partial-day exception handling
- exception date and type filtering
- edit and delete actions for both record types
- loading states
- API error states

### `client/src/App.jsx`

Connects the Availability workspace to the signed-in app shell.

The sidebar now switches between:

- `Dashboard`
- `Courses`
- `Coursework`
- `Availability`

Other navigation items are visible but disabled until their stages are built.

## Frontend Request Flow

Creating a weekly study window now follows this browser-to-backend path:

```text
Student fills weekly availability form
-> AvailabilityManagement handles submit
-> createWeeklyAvailability calls requestJson
-> fetch POST /api/availability/weekly
-> Authorization header sends JWT
-> backend verifies token and validates body
-> backend checks for overlapping windows
-> backend inserts weekly window owned by req.user.id
-> frontend reloads the weekly availability list
```

Creating an exception follows a similar path:

```text
Student fills exception form
-> AvailabilityManagement normalizes full-day or partial-day payload
-> createAvailabilityException calls requestJson
-> fetch POST /api/availability/exceptions
-> backend verifies token and validates body
-> backend checks exception conflicts
-> backend inserts exception owned by req.user.id
-> frontend reloads the exception list
```

## Weekly Availability Form Fields

The weekly form sends:

- `weekday`
- `startTime`
- `endTime`
- `label`

The backend still owns final validation. The frontend makes common input easier, but the server remains the source of truth for time ranges and conflicts.

## Availability Exception Form Fields

The exception form sends:

- `exceptionDate`
- `type`
- `isFullDay`
- `startTime`
- `endTime`
- `reason`

When `isFullDay` is true, the frontend sends `startTime: null` and `endTime: null` so the request matches the backend rule that full-day exceptions cannot include times.

When `isFullDay` is false, the frontend requires start and end times before the browser submits the form.

## List Filters

The Availability view can request:

```http
GET /api/availability/weekly
GET /api/availability/weekly?weekday=1
GET /api/availability/exceptions
GET /api/availability/exceptions?from=2026-08-19&to=2026-08-26
GET /api/availability/exceptions?type=extra_available
```

The default weekly view shows all days. The default exception view shows all exception types with no date limit.

## Error Handling

If the backend returns validation errors, the UI shows the first message and lists additional field messages when available.

If the backend returns `401`, the frontend clears the saved token and sends the student back to the auth screen.

Delete actions use a browser confirmation before sending the `DELETE` request.

## Why Availability Comes Before Study Plans

StudyGuard can only generate realistic study blocks after it knows two things:

- what work needs to be done
- when the student can actually study

Courses and coursework answer the first part. Weekly availability and exceptions answer the second part. Stage 12A can now design the study-plan API on top of those inputs.

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

## Stage 11C Acceptance Criteria

Stage 11C is complete when:

- Signed-in users can open the Availability view
- The frontend can list weekly windows from `GET /api/availability/weekly`
- The frontend can create weekly windows with `POST /api/availability/weekly`
- The frontend can edit weekly windows with `PATCH /api/availability/weekly/:availabilityWindowId`
- The frontend can delete weekly windows with `DELETE /api/availability/weekly/:availabilityWindowId`
- The frontend can list exceptions from `GET /api/availability/exceptions`
- The frontend can create exceptions with `POST /api/availability/exceptions`
- The frontend can edit exceptions with `PATCH /api/availability/exceptions/:availabilityExceptionId`
- The frontend can delete exceptions with `DELETE /api/availability/exceptions/:availabilityExceptionId`
- Full-day exceptions send null times
- Availability requests include the stored JWT
- API validation errors appear in the UI
- Expired sessions clear the token
- Frontend build passes
- Existing backend tests still pass
- You approve moving to Stage 12A

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

Before Stage 12A, make sure you can answer these:

1. Why does the Availability screen manage weekly windows and one-time exceptions separately?
2. Why should full-day exceptions send null times?
3. Why does the frontend still rely on backend validation for overlap conflicts?
4. What inputs does the future study-plan service need before it can schedule blocks?
