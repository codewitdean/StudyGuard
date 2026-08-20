# Stage 17A: MVP QA And Release Readiness Design

## Goal

Stage 17A designs the final MVP QA and release-readiness pass for StudyGuard.

All main signed-in navigation areas now exist:

- Dashboard
- Courses
- Coursework
- Availability
- Study Plan
- Recommendations
- Progress
- Profile

Stage 17A does not run the full QA pass yet. Stage 17B should execute this checklist, fix defects found during the pass, and document the final MVP readiness status.

## Current MVP Surface

### Frontend Screens

Implemented screens live in `client/src/components`:

- `Dashboard.jsx`
- `CourseManagement.jsx`
- `CourseworkManagement.jsx`
- `AvailabilityManagement.jsx`
- `StudyPlanManagement.jsx`
- `RecommendationManagement.jsx`
- `ProgressManagement.jsx`
- `ProfileManagement.jsx`

### Backend Route Groups

Implemented route groups live in `server/src/routes`:

- `/api/health`
- `/api/auth`
- `/api/courses`
- `/api/coursework`
- `/api/availability`
- `/api/study-plans`
- `/api/recommendations`
- `/api/progress`

### Automated Test Coverage

Backend tests currently cover:

- auth registration
- auth login
- current user and profile updates
- health route
- courses
- coursework
- availability
- study plan generation
- recommendations
- progress and study sessions

There are no frontend unit or browser automation tests yet. Stage 17B should rely on client build verification plus a manual browser QA checklist.

## Required Automation Checks

Stage 17B should run these from the repo root:

```bash
npm run format:check
npm run test:server
npm run build --workspace client
```

If formatting fails, run:

```bash
npm run format
```

Then rerun the checks.

## Local Environment Readiness

Stage 17B should confirm local environment files exist:

```text
server/.env
client/.env
```

Minimum backend variables:

- `DATABASE_URL`
- `JWT_SECRET`

Minimum frontend variables:

- `VITE_API_BASE_URL`

The README already documents copying examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Stage 17B should verify those examples still match the code.

## Database Readiness

Stage 17B should verify migrations can run cleanly:

```bash
npm run db:migrate
```

Expected result:

- migration runner completes without error
- core schema exists
- repeated run is safe because the migration tracker prevents duplicate application

Stage 17B should not create a new migration unless QA finds a real schema gap.

## Local Server Smoke Checks

Start both local servers:

```bash
npm run dev:server
npm run dev:client
```

Expected URLs:

- backend: `http://127.0.0.1:4000`
- frontend: `http://127.0.0.1:5173`

Smoke checks:

```bash
curl -s -o /tmp/studyguard-health.txt -w "%{http_code}" http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:5173/
```

Expected results:

- `/api/health` returns `200`
- frontend root returns `200`

## Manual Browser QA Flow

Stage 17B should run one full happy-path flow in the browser.

### 1. Auth

Verify:

- Register new account
- Sign out
- Log back in
- Session restores after page refresh
- Invalid login shows an error

### 2. Profile

Verify:

- Profile nav item is enabled
- Name can be updated
- Planning priority can be updated
- Email is visible but not editable
- Sidebar name and initials update after save
- Reset clears unsaved edits

### 3. Courses

Verify:

- Create a course
- Edit course fields
- Archive and restore the course
- Delete course
- Course filters work

### 4. Coursework

Verify:

- Create coursework with and without a course
- Edit due date, priority, difficulty, estimate, and status
- Mark coursework completed
- Filter by status, due date, course, and type
- Delete coursework

### 5. Availability

Verify:

- Create weekly availability
- Reject overlapping weekly availability
- Edit weekly availability
- Delete weekly availability
- Create one-time unavailable exception
- Create one-time extra-available exception
- Edit and delete exceptions

### 6. Study Plan

Verify:

- Generate a draft plan from coursework and availability
- View scheduled study blocks
- View warnings and explanations
- Approve a draft plan
- Archive a plan
- Dashboard reflects current plan status

### 7. Recommendations

Verify:

- Create a recommendation
- Edit recommendation JSON
- Approve a pending recommendation
- Reject another recommendation
- Delete recommendation
- Filters work for review, approved, rejected, and all states

### 8. Progress

Verify:

- Log a study session
- Edit the study session
- Delete the study session
- Progress summary updates
- Date filters work
- Recent sessions render linked coursework or general study labels

### 9. Dashboard

Verify:

- Open tasks count uses real coursework
- Due today count uses local date grouping
- Study blocks come from current study plan detail
- Upcoming deadlines show real coursework
- Weekly workload uses progress and plan data
- Recommendations count links to Recommendations
- Dashboard refresh reloads data
- Workload badge reflects selected plan overload status

## Negative QA Checks

Stage 17B should include a smaller negative pass:

- Open protected API route without token returns `401`
- Expired or invalid token signs out the frontend
- Invalid form submissions show useful field errors
- Empty update forms are blocked or rejected
- Not-found resources show controlled errors rather than blank screens
- API unavailable state shows the frontend API connection error

## Accessibility And UX Checks

Stage 17B should manually review:

- keyboard tab order through sidebar and forms
- visible focus states
- field labels are present
- error messages are visible near relevant fields
- buttons clearly disable while saving or loading
- tables remain usable on small screens through horizontal scroll
- no text overlaps at mobile width
- Profile, Dashboard, and form cards do not nest cards inside cards

## Data Privacy Checks

Stage 17B should confirm:

- no response includes `password_hash`
- frontend never sends `userId`
- owned-resource APIs are scoped to the signed-in user
- cross-user access tests remain green
- sign out clears local auth token
- `.env` files are gitignored

## Known MVP Limitations To Keep

These are acceptable for the MVP and should be documented rather than fixed in Stage 17B unless they cause broken behavior:

- no frontend automated browser tests yet
- no deployed production target yet
- no email-change flow
- no password-change flow
- no account deletion UI
- no timezone preference
- no notification settings
- no custom planning-rule editor
- recommendations approval records decisions but does not yet mutate study plans automatically

## Release Readiness Output

Stage 17B should produce a readiness document with:

- commands run
- pass/fail results
- manual QA notes
- defects fixed during QA
- known limitations intentionally left for later
- final MVP status

Suggested file:

```text
docs/stage-17b-mvp-qa-release-readiness-implementation.md
```

## Acceptance Criteria For Stage 17B

Stage 17B is complete when:

- required automation checks pass
- migrations are verified
- local backend and frontend smoke checks pass
- full manual browser QA flow is completed
- defects found during QA are fixed or explicitly documented
- privacy checks pass
- README remains accurate
- Stage 17B readiness document is added

## Next Stage

After Stage 17B, the project can either:

- prepare a first deployment stage, or
- add higher-confidence frontend browser tests before deployment.
