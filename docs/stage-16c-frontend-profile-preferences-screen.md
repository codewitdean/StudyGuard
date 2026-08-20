# Stage 16C: Frontend Profile Preferences Screen

## Goal

Stage 16C enables the Profile nav item and adds the frontend screen for editing safe profile preferences.

The screen uses the Stage 16B API helper:

```js
updateCurrentStudent(token, profile);
```

No backend changes, database migration, or new dependency were needed.

## Implemented Files

- `client/src/components/ProfileManagement.jsx`
- `client/src/App.jsx`
- `docs/stage-16c-frontend-profile-preferences-screen.md`
- `README.md`

## Profile Screen

The Profile screen now supports:

- editing the signed-in student's `name`
- editing `planningPriority`
- showing `email` as read-only account data
- showing created and updated timestamps
- saving profile changes through `PATCH /api/auth/me`
- resetting unsaved local form changes
- showing validation errors returned by the API
- signing the user out through the existing expired-session flow on `401`

## Navigation

The Profile item is now included in `implementedNavItems`, so it is enabled in the signed-in sidebar.

The app title for this view is:

```text
Profile Preferences
```

## State Flow

`App.jsx` passes `setCurrentUser` into `ProfileManagement` as `onProfileUpdated`.

After a successful save:

1. `ProfileManagement` calls `updateCurrentStudent`.
2. The API returns the updated safe user object.
3. `ProfileManagement` calls `onProfileUpdated(data.user)`.
4. `App.jsx` updates shared `currentUser` state.
5. The sidebar name, initials, page greeting, and Profile summary update immediately.

The auth token is not changed by profile updates.

## Validation Behavior

Client-side behavior:

- Save is disabled until the form differs from the current profile.
- Reset is disabled until the form differs from the current profile.
- The name input is required and limited to 120 characters.
- API field errors display below their matching controls.

Server-side behavior still owns final validation.

## Non-Goals

Stage 16C does not add:

- email editing
- password editing
- account deletion
- timezone preferences
- notification settings
- custom planning-rule editing

Those need separate API and product passes.

## Acceptance Criteria

Stage 16C is complete when:

- Profile nav item is enabled
- Profile screen renders for signed-in users
- current name and planning priority are loaded from `currentUser`
- email is visible but not editable
- saving calls `PATCH /api/auth/me`
- successful save updates shared `currentUser`
- validation errors display in the form
- `401` responses use the existing auth-expired flow
- `npm run build --workspace client` passes
- Prettier check passes for touched files

## Next Stage

Stage 17A should design the MVP QA and release-readiness pass now that all main signed-in navigation areas are implemented.
