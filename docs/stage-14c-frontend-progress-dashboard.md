# Stage 14C: Frontend Progress Dashboard

## Goal

Stage 14C adds the frontend Progress dashboard.

Students can now view progress metrics, review recent study sessions, and log manual study time from the signed-in app.

## Implemented Files

- `client/src/api/progressApi.js`
- `client/src/components/ProgressManagement.jsx`
- `client/src/App.jsx`

## Navigation

`Progress` is now an implemented signed-in navigation item.

The page title is:

```text
Track Progress
```

## API Client

Added `client/src/api/progressApi.js` with helpers for:

- `getProgressSummary`
- `listStudySessions`
- `createStudySession`
- `updateStudySession`
- `deleteStudySession`

The client uses the existing `requestJson` helper, so it keeps the same auth token, API base URL, and error behavior as the rest of the app.

## Progress View

The new `ProgressManagement` component includes:

- date range filters
- session source filter
- optional coursework ID filter
- progress summary cards
- estimate accuracy badge
- recent study session list
- manual study-session form
- edit and delete actions for sessions
- loading, empty, success, and error states

## Summary Metrics

The dashboard displays:

- completed tasks
- missed tasks
- postponed tasks
- open tasks
- total due tasks
- study time
- session count
- average session length
- estimate accuracy label
- compared coursework count
- average estimated time
- average actual time

## Study Session Form

The form supports:

- source
- duration minutes
- start and end timestamps
- optional coursework ID
- optional study block ID
- notes

The first frontend pass keeps linked IDs as text inputs. A later polish stage can replace those with coursework and study-plan selectors.

## Auth Behavior

If any progress request returns `401 Unauthorized`, the component calls `onAuthExpired` and returns the student to the login flow.

## Verification

Client build passed:

```text
vite v8.2.1 building client environment for production
✓ built
```

## Next Stage

Stage 15A should design dashboard data integration.

The next app area should replace placeholder dashboard cards with real data from:

- coursework
- study plans
- recommendations
- progress
