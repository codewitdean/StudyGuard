# Stage 12B: Study Plan Generation API Implementation

## Goal

The goal of Stage 12B is to implement the Study Plan API designed in Stage 12A.

A signed-in student can now ask the backend to generate a draft study plan from owned coursework, weekly availability, one-time exceptions, and planning priority.

This stage is backend-only. The browser UI for generating and reviewing study plans comes next in Stage 12C.

## What The API Can Do Now

The backend can:

- generate a draft study plan
- expand weekly availability into calendar slots
- apply full-day and partial-day unavailable exceptions
- apply partial-day extra-available exceptions
- load open coursework for the signed-in student
- exclude completed, missed, archived, and other-student coursework
- place study blocks inside available slots
- avoid scheduling coursework after its due date
- return workload summaries
- return warning codes for overload and missing availability
- list owned study plans
- get one owned study plan with its blocks
- approve a draft plan
- archive overlapping active plans when a new draft is approved
- archive draft or active plans

## Files Added Or Changed

### `server/src/database/db.js`

Adds a `transaction` helper.

Study plan generation needs a transaction because the plan row and its study blocks should commit together or roll back together.

### `server/src/validators/studyPlanValidators.js`

Adds Zod schemas for:

- `POST /api/study-plans/generate`
- `GET /api/study-plans`
- `GET /api/study-plans/:studyPlanId`
- `POST /api/study-plans/:studyPlanId/approve`
- `POST /api/study-plans/:studyPlanId/archive`

Validation covers:

- `YYYY-MM-DD` dates
- date order
- maximum 31-day generation range
- planning priority values
- list status filters
- UUID route params

### `server/src/services/schedulingService.js`

Adds deterministic scheduling logic.

It handles:

- date range creation
- weekday matching
- local wall-clock time conversion
- availability slot expansion
- exception application
- slot merging
- coursework sorting
- study block creation
- overload status calculation
- warning generation

### `server/src/services/studyPlanService.js`

Adds the database service for study plans.

It handles:

- loading the student's saved planning priority
- loading owned open coursework
- loading owned weekly availability
- loading owned availability exceptions
- creating draft plans and blocks in a transaction
- archiving older draft plans for the same exact range
- listing plans with summary counts
- loading one detailed plan
- approving draft plans
- archiving overlapping active plans
- archiving plans

### `server/src/controllers/studyPlanController.js`

Adds thin controller functions for the route layer.

### `server/src/routes/studyPlanRoutes.js`

Mounts the study plan routes behind `requireAuth`.

### `server/src/app.js`

Mounts the route group:

```js
app.use("/api/study-plans", studyPlanRoutes);
```

### `server/tests/studyPlanRoutes.test.js`

Adds route coverage for the new API.

## Implemented Endpoints

### Generate Draft Plan

```http
POST /api/study-plans/generate
```

Creates a draft plan and any scheduled study blocks.

Request body:

```json
{
  "startDate": "2027-02-15",
  "endDate": "2027-02-21",
  "planningPriority": "balance_deadlines_wellbeing"
}
```

All fields are optional.

If `startDate` is omitted, the backend uses today.

If `endDate` is omitted, the backend uses a seven-day range.

If `planningPriority` is omitted, the backend uses the student's saved `planning_priority`.

### List Plans

```http
GET /api/study-plans
```

Supports:

```http
GET /api/study-plans?status=current
GET /api/study-plans?status=active
GET /api/study-plans?status=draft
GET /api/study-plans?status=archived
GET /api/study-plans?status=all
GET /api/study-plans?from=2027-02-15&to=2027-02-21
```

`current` means draft or active.

Date filters return plans whose date ranges overlap the requested range.

### Get One Plan

```http
GET /api/study-plans/:studyPlanId
```

Returns the owned plan and its blocks.

Another student's plan returns `404`.

### Approve Draft Plan

```http
POST /api/study-plans/:studyPlanId/approve
```

Approving a draft:

- changes the plan status to `active`
- sets `approved_at`
- archives overlapping active plans for the same user

Only draft plans can be approved.

### Archive Plan

```http
POST /api/study-plans/:studyPlanId/archive
```

Archives an owned draft or active plan.

Archived plans are not deleted and can still be loaded when requested.

## Scheduling Inputs

The generator reads these owner-scoped inputs:

- `users.planning_priority`
- open coursework
- weekly availability windows
- availability exceptions inside the plan date range

Open coursework means:

- `not_started`
- `in_progress`
- `postponed`

Closed coursework is excluded:

- `completed`
- `missed`
- `archived`

## Scheduling Rules

The MVP scheduler is intentionally deterministic.

It currently uses these rules:

- expand weekly availability across the requested date range
- apply exceptions after weekly windows are expanded
- merge overlapping or adjacent slots
- schedule due-dated coursework before no-due-date coursework
- prioritize due date, priority, difficulty, and grade weight
- create study blocks up to 90 minutes each
- do not create blocks shorter than 25 minutes
- never create a block outside availability
- never schedule a block after its coursework due date

## Exception Behavior

Full-day unavailable exceptions remove all availability for that date.

Partial unavailable exceptions subtract their time range from matching slots.

Partial extra-available exceptions add a new slot for that date.

Full-day extra-available exceptions use the MVP default day slot:

```text
09:00 to 21:00
```

## Warning Codes

The API can return these warning codes:

- `custom_priority_not_configured`
- `no_availability`
- `insufficient_availability`
- `due_before_available_time`
- `partial_schedule`

The frontend should treat warning codes as stable identifiers and warning messages as user-facing text.

## Transaction Behavior

Generating a plan uses a transaction:

```text
BEGIN
-> archive older matching draft plans
-> insert study_plans row
-> insert study_blocks rows
COMMIT
```

If any block insert fails, the draft plan insert rolls back too.

## Response Shape

Detailed responses include:

- `studyPlan`
- `studyBlocks`
- `summary`
- `unscheduledCoursework`
- `warnings`
- `explanations`

Example summary:

```json
{
  "availableMinutes": 180,
  "requiredMinutes": 240,
  "scheduledMinutes": 180,
  "unscheduledMinutes": 60,
  "studyBlockCount": 2,
  "studyDayCount": 1,
  "overloadStatus": "overloaded"
}
```

## Error Decisions

Missing token:

```text
401 Authentication required.
```

Invalid token:

```text
401 Invalid or expired token.
```

Invalid body, params, or query:

```text
400 Validation failed.
```

Plan not found or not owned:

```text
404 Study plan not found.
```

Invalid state change:

```text
409 Only draft study plans can be approved.
409 Study plan is already archived.
```

## Tests Added

The Stage 12B tests verify:

- authentication is required
- invalid dates and filters return `400`
- default generation covers seven days
- saved planning priority is used by default
- draft plans are created
- study blocks are owner-scoped
- closed coursework is excluded
- other-student coursework is excluded
- custom planning returns a warning
- full-day unavailable exceptions remove availability
- partial unavailable exceptions subtract time
- extra-available exceptions add time
- blocks are not scheduled after due dates
- list and get are owner-scoped
- approving draft plans works
- approving overlapping plans archives older active plans
- archiving plans works
- invalid state changes return `409`

## Commands

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Run only Stage 12B tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test --workspace server -- studyPlanRoutes.test.js
```

Run the backend:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev JWT_SECRET=replace-with-a-long-random-secret npm run dev:server
```

## Stage 12B Acceptance Criteria

Stage 12B is complete when:

- `/api/study-plans` routes are mounted
- generation validates request bodies
- generation creates draft study plans
- generation creates study blocks in a transaction
- generation uses owned coursework only
- generation uses owned availability only
- full-day unavailable exceptions affect scheduling
- partial unavailable exceptions affect scheduling
- extra-available exceptions affect scheduling
- study blocks do not exceed due dates
- list/get routes are owner-scoped
- approve/archive routes work
- invalid state changes return `409`
- backend tests pass
- you approve moving to Stage 12C

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

Before Stage 12C, make sure you can answer these:

1. Why does generation use a transaction?
2. Why should generated plans start as drafts?
3. Why do availability exceptions apply after weekly availability is expanded?
4. Why does the API return warning codes instead of only warning text?
