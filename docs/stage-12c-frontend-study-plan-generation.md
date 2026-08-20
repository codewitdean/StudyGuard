# Stage 12C: Frontend Study Plan Generation

## Goal

The goal of Stage 12C is to connect the React frontend to the Study Plan API from Stage 12B.

A signed-in student can now generate a draft study plan in the browser, review scheduled blocks, inspect workload warnings, approve a plan, and archive plans.

## What The Frontend Can Do Now

The Study Plan screen can:

- load saved draft and active plans
- filter plans by status and date overlap
- generate a draft plan for a date range
- optionally choose a planning priority for generation
- open a saved plan
- show workload summary stats
- show overload status
- show warning messages from the backend
- show unscheduled coursework
- show scheduled study blocks
- approve draft plans
- archive draft or active plans
- clear the session when the token expires

## Files Added Or Changed

### `client/src/api/studyPlanApi.js`

Adds frontend API functions for study plans:

- `listStudyPlans`
- `generateStudyPlan`
- `getStudyPlan`
- `approveStudyPlan`
- `archiveStudyPlan`

Each function sends the JWT as:

```http
Authorization: Bearer <token>
```

The list helper builds query strings for:

- `status`
- `from`
- `to`

### `client/src/components/StudyPlanManagement.jsx`

Adds the signed-in Study Plan workspace.

It contains:

- generation form state
- saved plan filter state
- plan list loading
- plan detail loading
- generate submit handling
- approve action handling
- archive action handling
- summary cards
- warning panel
- unscheduled coursework list
- study block table
- validation and API error handling

### `client/src/App.jsx`

Connects the Study Plan workspace to the signed-in app shell.

The sidebar now switches between:

- `Dashboard`
- `Courses`
- `Coursework`
- `Availability`
- `Study Plan`

Other navigation items are visible but disabled until their stages are built.

## Frontend Request Flow

Generating a draft plan follows this browser-to-backend path:

```text
Student opens Study Plan
-> StudyPlanManagement loads current plans
-> Student chooses dates and optional priority
-> generateStudyPlan calls requestJson
-> fetch POST /api/study-plans/generate
-> Authorization header sends JWT
-> backend verifies token and validates body
-> backend generates draft plan and study blocks
-> frontend displays summary, warnings, unscheduled work, and blocks
-> frontend refreshes the saved plan list
```

Approving a draft follows this path:

```text
Student clicks Approve Plan
-> approveStudyPlan calls requestJson
-> fetch POST /api/study-plans/:studyPlanId/approve
-> backend activates the plan and archives overlapping active plans
-> frontend refreshes the active plan detail and saved plan list
```

## Generate Form Fields

The generate form sends:

- `startDate`
- `endDate`
- `planningPriority`

If `planningPriority` is blank, the frontend omits it so the backend uses the student's saved profile priority.

The backend still owns final validation for date formats, maximum range, and allowed priority values.

## Plan List Filters

The Study Plan view can request:

```http
GET /api/study-plans?status=current
GET /api/study-plans?status=draft
GET /api/study-plans?status=active
GET /api/study-plans?status=archived
GET /api/study-plans?status=all
GET /api/study-plans?from=2027-02-15&to=2027-02-21
```

The default view shows current plans, meaning draft and active plans.

## Plan Review Areas

A detailed plan response renders as:

- plan status and date range
- planning priority
- overload status
- available, required, scheduled, and unscheduled minutes
- block and study-day counts
- warning messages
- unscheduled coursework
- study blocks table

The frontend treats warning codes as stable backend identifiers and renders the backend message as user-facing text.

## Error Handling

If the backend returns validation errors, the UI shows the first message and lists additional field messages when available.

If the backend returns `401`, the frontend clears the saved token and sends the student back to the auth screen.

Archive actions use a browser confirmation before sending the request.

## Why This Comes Before Recommendations

Stage 12C gives the student a generated schedule they can inspect and approve.

Recommendations come next because StudyGuard should suggest changes to an existing workload or plan, but those suggestions need a plan and study blocks to reference.

## Commands

Run the backend:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev JWT_SECRET=replace-with-a-long-random-secret npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Build the frontend:

```bash
npm run build --workspace client
```

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

## Stage 12C Acceptance Criteria

Stage 12C is complete when:

- Signed-in users can open the Study Plan view
- The frontend can list plans from `GET /api/study-plans`
- The frontend can generate a plan with `POST /api/study-plans/generate`
- The frontend can open a saved plan with `GET /api/study-plans/:studyPlanId`
- The frontend can approve draft plans
- The frontend can archive plans
- Plan summary data appears in the UI
- Warnings appear in the UI
- Unscheduled coursework appears in the UI
- Study blocks appear in the UI
- Study plan requests include the stored JWT
- API validation errors appear in the UI
- Expired sessions clear the token
- Frontend build passes
- Existing backend tests still pass
- You approve moving to Stage 13A

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

Before Stage 13A, make sure you can answer these:

1. Why does the frontend omit blank `planningPriority`?
2. Why should students review a generated draft before approving it?
3. Why does the UI show warning codes as user-facing messages instead of recalculating warnings?
4. Why do recommendations need generated plans and study blocks to exist first?
