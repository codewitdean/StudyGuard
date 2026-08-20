# Stage 13C: Frontend Recommendations Review

## Goal

Stage 13C adds the frontend recommendations review experience.

Students can now open the Recommendations view, review pending or edited suggestions, edit the proposed JSON change, approve, reject, or delete recommendations.

## Implemented Files

- `client/src/api/recommendationApi.js`
- `client/src/components/RecommendationManagement.jsx`
- `client/src/App.jsx`

## Navigation

`Recommendations` is now an implemented signed-in navigation item.

The page title is:

```text
Review Recommendations
```

## API Client

Added `client/src/api/recommendationApi.js` with helpers for:

- `listRecommendations`
- `createRecommendation`
- `editRecommendation`
- `approveRecommendation`
- `rejectRecommendation`
- `deleteRecommendation`

The client uses the existing `requestJson` helper, so it keeps the same auth token, API base URL, and error behavior as the rest of the app.

## Recommendations View

The new `RecommendationManagement` component includes:

- a draft recommendation form
- a review queue
- status and type filters
- visible, pending, edited, and decided summary counts
- recommendation cards with type and status badges
- related coursework and study block summaries when available
- proposed and edited change JSON previews
- approve, reject, edit, and delete actions
- loading, empty, success, and error states

## Draft Form

The draft form lets the app create recommendations before automatic recommendation generation exists.

It supports:

- recommendation type
- title
- reason
- proposed change JSON object

Changing the type resets the proposed change template to a matching action shape.

## Edit Flow

Selecting `Edit` opens an edit panel with the current edited change if one exists, otherwise the original proposed change.

Submitting the edit:

- parses the JSON locally
- requires a JSON object
- sends `PATCH /api/recommendations/:recommendationId`
- refreshes the queue
- preserves the original proposed change on the backend

## Decision Flow

The frontend calls the Stage 13B decision endpoints:

- `POST /api/recommendations/:recommendationId/approve`
- `POST /api/recommendations/:recommendationId/reject`

Approved and rejected recommendations are terminal on the backend, so the UI only shows edit, approve, and reject actions for non-terminal recommendations.

Delete remains available for cleanup.

## Auth Behavior

If any recommendation request returns `401 Unauthorized`, the component calls `onAuthExpired` and returns the student to the login flow.

## Verification

Client build passed:

```text
vite v8.2.1 building client environment for production
✓ built
```

## Next Stage

Stage 14A should design the Progress API.

The next backend area should cover:

- study sessions
- completed task counts
- missed task counts
- postponed task counts
- actual study time
- estimate accuracy
