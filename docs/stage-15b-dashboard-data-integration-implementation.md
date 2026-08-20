# Stage 15B: Dashboard Data Integration Implementation

## Goal

Stage 15B turns the signed-in Dashboard from static placeholder cards into a live summary view backed by the authenticated StudyGuard APIs.

This stage is frontend-only. No database migration, backend route, or new dependency was needed.

## Implemented Files

- `client/src/App.jsx`
- `client/src/components/Dashboard.jsx`
- `docs/stage-15b-dashboard-data-integration-implementation.md`
- `README.md`

## Dashboard Data Sources

The Dashboard now composes data from the existing API clients:

- `listCoursework(token, { status: "open", sort: "dueDate" })`
- `listCoursework(token, { status: "open", due: "overdue", sort: "dueDate" })`
- `listStudyPlans(token, { status: "current" })`
- `getStudyPlan(token, selectedPlan.id)` when a current plan exists
- `listRecommendations(token)`
- `getProgressSummary(token)`

The dashboard selects an active study plan first. If no active plan exists, it uses the newest draft returned by the current-plan list.

## Dashboard View Model

`client/src/components/Dashboard.jsx` now builds a derived dashboard model with:

- open coursework
- overdue coursework
- tasks due today
- dashboard task previews
- upcoming deadlines
- selected current study plan
- today's study blocks
- next upcoming study blocks
- current plan summary
- review-needed recommendations
- current-week progress summary
- workload status

This keeps the JSX focused on rendering and keeps the API response details in one transformation path.

## Dashboard Sections

### Profile

The Profile card still shows the signed-in student's email and planning priority, but now includes:

- last dashboard refresh time
- `Refresh Data`
- `Refresh Profile`

`Refresh Data` reloads dashboard API data without needing to refresh the whole page.

### At-A-Glance Metrics

A new metric row shows:

- Open Tasks
- Due Today
- Study Time
- Recommendations

Each metric includes a navigation action to the full feature screen.

### Today's Tasks

The Dashboard shows coursework due on today's local browser date.

If nothing is due today, it falls back to the next open coursework items so the card is still useful.

### Study Blocks

The Dashboard loads the selected current study plan detail and shows blocks scheduled for today.

If no block is scheduled today, it falls back to the next upcoming blocks.

### Upcoming Deadlines

The Dashboard orders deadlines as:

1. overdue work
2. work due today
3. remaining open coursework

The card previews up to five items and links to the Coursework view for the full list.

### Weekly Workload

Weekly Workload now uses progress summary and selected plan summary data:

- completed task count
- open due task count
- missed task count
- postponed task count
- logged study time
- scheduled study time
- estimate accuracy
- selected plan status
- selected plan overload status

If recommendations need review, the workload area includes a button to jump to Recommendations.

## Workload Badge

The page-level workload badge now reflects the selected current plan when the Dashboard has loaded:

- `balanced` -> `Workload status: Balanced`
- `heavy` -> `Workload status: Heavy`
- `overloaded` -> `Workload status: Overloaded`
- missing or `unknown` -> `Workload status: Waiting for study plan`

## Auth And Error Handling

If any dashboard request returns `401`, the app signs the user out through the existing `onAuthExpired` flow.

For non-auth failures, the Dashboard keeps the Profile card visible and shows a dashboard-level error with a retry path through `Refresh Data`.

## Acceptance Criteria

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
- Prettier check passes for touched files

## Next Stage

Stage 16A should design Profile preferences so the disabled Profile nav item can become a real screen for updating student settings such as name, planning priority, and eventually timezone.
