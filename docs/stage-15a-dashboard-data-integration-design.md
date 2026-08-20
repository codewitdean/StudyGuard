# Stage 15A: Dashboard Data Integration Design

## Goal

The goal of Stage 15A is to design how the signed-in Dashboard should replace its placeholder cards with real StudyGuard data.

StudyGuard now has the core data areas needed for a meaningful dashboard:

- coursework and deadlines
- generated study plans and study blocks
- recommendations awaiting review
- progress summaries and study sessions

This stage does not add route code or React implementation yet. The implementation comes in Stage 15B.

## Current Dashboard State

The current dashboard in `client/src/App.jsx` is still a scaffold:

- Profile card uses the signed-in student from `GET /api/auth/me`
- `Today's Tasks` says no coursework exists
- `Study Blocks` says no study blocks exist
- `Upcoming Deadlines` says no deadlines exist
- `Weekly Workload` says required and available hours will appear later
- The page-level badge says `Workload status: Waiting for coursework`

Stage 15B should keep the same dashboard intent but replace static card text with live data.

## Product Reference

The Stage 2 wireframe describes the dashboard as the first signed-in view:

```text
Dashboard
Today
[ Workload Status: Balanced / Heavy / Overloaded ]

Today's Tasks             Today's Study Blocks
- Math problem set        4:00-5:00 PM Biology
- Read history chapter    6:00-7:30 PM Math

Upcoming Deadlines        Weekly Workload
- Chem quiz Friday        Required: 12h
- Essay Sunday            Available: 10h
```

Important dashboard data:

- today's coursework
- generated study blocks
- upcoming deadlines
- weekly workload

## Existing APIs To Compose

Stage 15B can be frontend-only because the existing authenticated APIs already expose enough data.

### Current Student

```js
getCurrentStudent(token);
```

Used for the profile card and account refresh behavior.

Expected unwrapped shape:

```json
{
  "user": {}
}
```

### Coursework

```js
listCoursework(token, { status: "open", sort: "dueDate" });
listCoursework(token, { status: "open", due: "upcoming", sort: "dueDate" });
listCoursework(token, { status: "open", due: "overdue", sort: "dueDate" });
```

Expected unwrapped shape:

```json
{
  "coursework": []
}
```

Dashboard usage:

- compute open task count
- compute tasks due today on the client from `dueAt`
- show top open tasks when nothing is due today
- show upcoming deadlines sorted by `dueAt`
- show overdue work as urgent items before upcoming work when present

### Study Plans

```js
listStudyPlans(token, { status: "current" });
getStudyPlan(token, studyPlanId);
```

Expected list shape:

```json
{
  "studyPlans": []
}
```

Expected detail shape:

```json
{
  "studyPlan": {},
  "studyBlocks": [],
  "summary": {}
}
```

Dashboard usage:

- choose an active plan first
- if no active plan exists, choose the newest draft plan
- load the selected plan detail to access `studyBlocks`
- compute today's blocks from `startAt`
- show the next upcoming blocks when today has no scheduled blocks
- use `studyPlan.overloadStatus` for the page workload badge when available
- use `summary.scheduledMinutes` and `summary.studyBlockCount` in weekly workload

### Recommendations

```js
listRecommendations(token);
```

The default client call returns pending and edited recommendations for review.

Expected unwrapped shape:

```json
{
  "recommendations": []
}
```

Dashboard usage:

- show review-needed count
- show the top few pending or edited suggestions
- provide a button that switches to the Recommendations view

### Progress

```js
getProgressSummary(token);
```

Expected unwrapped shape:

```json
{
  "progress": {
    "range": {},
    "taskCounts": {},
    "studyTime": {},
    "estimateAccuracy": {},
    "recentSessions": []
  }
}
```

Dashboard usage:

- show completed, missed, postponed, and open task counts for the current week
- show total study minutes as hours and minutes
- show estimate accuracy label when enough data exists
- show recent sessions only if the dashboard has space after the core cards

## Dashboard Data Model

Stage 15B should derive a single view model in the dashboard component, even if the data comes from several API calls.

```js
{
  coursework: {
    openTasks: [],
    overdueTasks: [],
    dueTodayTasks: [],
    upcomingDeadlines: []
  },
  studyPlan: {
    selectedPlan: null,
    todayBlocks: [],
    nextBlocks: [],
    summary: null
  },
  recommendations: {
    reviewItems: [],
    reviewCount: 0
  },
  progress: {
    summary: null
  },
  workloadStatus: "unknown"
}
```

This model keeps rendering logic simple and makes empty states easier to manage.

## Dashboard Sections

### 1. At-A-Glance Metrics

Add a compact top row above the four existing dashboard cards.

Recommended metrics:

- Open tasks
- Due today
- Study time this week
- Recommendations to review

These should use real counts and clear empty states.

### 2. Today's Tasks

Primary source:

- open coursework whose `dueAt` matches today's local date

Fallback:

- next five open tasks sorted by due date

Each item should show:

- title
- course name or code when present
- due date or time
- priority
- current status

Empty state:

```text
No coursework due today.
```

If no open coursework exists at all:

```text
Add coursework to start building your dashboard.
```

### 3. Study Blocks

Primary source:

- selected current study plan detail
- blocks whose `startAt` matches today's local date

Fallback:

- next three upcoming planned blocks

Each item should show:

- time range
- coursework title when linked
- block type
- duration
- status

Empty state:

```text
Generate a study plan to see study blocks here.
```

### 4. Upcoming Deadlines

Primary source:

- open coursework sorted by due date

Ordering:

1. overdue tasks
2. tasks due today
3. upcoming tasks

Each item should show:

- title
- course name or code when present
- due date
- priority
- estimated time

Limit the dashboard preview to five items. The Coursework view remains the full management screen.

### 5. Weekly Workload

Primary sources:

- progress summary
- selected study plan summary

Show:

- completed tasks this week
- missed or postponed tasks this week
- open tasks due this week
- logged study time this week
- scheduled study time from the selected plan
- estimate accuracy label when available

The page-level workload badge should prefer `selectedPlan.overloadStatus`.

Badge mapping:

- `balanced` -> `Workload status: Balanced`
- `heavy` -> `Workload status: Heavy`
- `overloaded` -> `Workload status: Overloaded`
- `unknown` or missing -> `Workload status: Waiting for study plan`

### 6. Recommendations Preview

Recommendations do not need a full dashboard card yet, but the at-a-glance row should surface the review count.

If there are review items, show a small call to action near the workload area:

```text
3 recommendations need review.
```

The action should switch to the Recommendations view with `onViewChange("Recommendations")`.

## Fetch Strategy

Stage 15B should fetch dashboard data when the Dashboard mounts.

Recommended calls:

```js
const [
  openCourseworkData,
  overdueCourseworkData,
  studyPlansData,
  recommendationsData,
  progressData,
] = await Promise.all([
  listCoursework(authToken, { status: "open", sort: "dueDate" }),
  listCoursework(authToken, {
    status: "open",
    due: "overdue",
    sort: "dueDate",
  }),
  listStudyPlans(authToken, { status: "current" }),
  listRecommendations(authToken),
  getProgressSummary(authToken),
]);
```

Then, if a current plan exists:

```js
const studyPlanData = await getStudyPlan(authToken, selectedPlan.id);
```

Selection rule:

1. active plan first
2. newest draft plan second
3. no plan

The existing study-plan list endpoint already sorts newest generated plans first, so the first draft is a reasonable fallback.

## State And Error Handling

Dashboard state should include:

- loading status
- error message
- dashboard data
- last refreshed timestamp

Authentication behavior:

- if any dashboard request returns `401`, call `onAuthExpired`
- do not keep rendering stale private data after auth expires

MVP error behavior:

- show one dashboard-level error message when data cannot load
- keep the Profile card visible because it already has `currentUser`
- let the Refresh button retry dashboard data, not just profile refresh

Future improvement:

- switch from all-or-nothing loading to section-level partial errors if dashboard fan-out becomes noisy

## Date Rules

Use local browser dates for dashboard grouping because the dashboard is a student-facing daily view.

Rules:

- `dueAt` on the same local date as now means due today
- `startAt` on the same local date as now means today's study block
- upcoming blocks use `startAt >= now`
- overdue coursework comes from the backend `due=overdue` filter

Stage 15B should add small helper functions inside the dashboard component or a nearby utility only if it keeps the component readable.

## Navigation Hooks

The current dashboard only receives profile refresh props. Stage 15B should pass more props from `SignedInScreen`:

```jsx
<DashboardView
  authToken={authToken}
  currentUser={currentUser}
  isChecking={isChecking}
  onAuthExpired={onAuthExpired}
  onRefreshCurrentUser={onRefreshCurrentUser}
  onViewChange={onViewChange}
  statusMessage={statusMessage}
/>
```

This lets dashboard cards link to the full Coursework, Study Plan, Recommendations, and Progress screens without adding routing.

## Implementation Boundary For Stage 15B

Stage 15B should be frontend-only unless an API contract gap appears during implementation.

Expected files:

- `client/src/App.jsx`
- existing API clients from `client/src/api/*Api.js`
- optional `docs/stage-15b-dashboard-data-integration-implementation.md`
- `README.md` roadmap update

No database migration is expected.
No new backend endpoint is expected.
No new dependency is expected.

## Acceptance Criteria For Stage 15B

Stage 15B is complete when:

- Dashboard no longer shows static placeholder card bodies for implemented data areas
- Dashboard fetches authenticated coursework, current study plan, recommendations, and progress summary
- today's tasks are derived from real coursework
- study blocks are derived from the current study plan detail
- upcoming deadlines are derived from real coursework
- weekly workload uses progress summary and selected plan summary
- workload badge reflects selected plan overload status when available
- dashboard actions can switch to the full feature screens
- expired sessions still sign the user out cleanly
- `npm run build --workspace client` passes
- `npx prettier --check README.md docs/stage-15a-dashboard-data-integration-design.md client/src/App.jsx` passes after implementation
