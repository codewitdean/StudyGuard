# Stage 16B: Profile Preferences API Implementation

## Goal

Stage 16B implements the Profile preferences API designed in Stage 16A.

A signed-in student can now update safe profile preferences through the existing current-user auth path:

```http
PATCH /api/auth/me
```

No database migration or new dependency was needed.

## Implemented Files

- `server/src/validators/authValidators.js`
- `server/src/services/authService.js`
- `server/src/controllers/authController.js`
- `server/src/routes/authRoutes.js`
- `server/tests/authCurrentUser.test.js`
- `client/src/api/authApi.js`
- `docs/stage-16b-profile-preferences-api-implementation.md`
- `README.md`

## API Contract

### Update Current User

```http
PATCH /api/auth/me
```

Authentication required: yes.

Supported body fields:

```json
{
  "name": "Maya C.",
  "planningPriority": "prevent_burnout"
}
```

All supported fields are optional individually, but at least one must be provided.

## Validation

The update validator now accepts:

- `name`: trimmed string, 1 to 120 characters
- `planningPriority`: one of `meet_deadlines`, `prevent_burnout`, `balance_deadlines_wellbeing`, or `custom`

The update body is strict, so unknown fields such as `email` are rejected instead of silently ignored.

Empty bodies are rejected with `400 Bad Request`.

## Service Behavior

`updateCurrentUserById(userId, updates)` now:

- maps `planningPriority` to `planning_priority`
- updates only provided fields
- always scopes the update to `WHERE id = $1`
- updates `updated_at`
- returns safe user fields through the existing user mapper
- returns `401 Unauthorized` if the token points to a deleted user

The response never includes password data.

## Route Wiring

The auth router now includes:

```js
router.patch(
  "/me",
  requireAuth,
  validateRequest(updateCurrentUserSchema),
  asyncHandler(updateCurrentUser),
);
```

This keeps current-user read and update operations together:

- `GET /api/auth/me`
- `PATCH /api/auth/me`

## Frontend API Helper

`client/src/api/authApi.js` now includes:

```js
export function updateCurrentStudent(token, profile) {
  return requestJson("/api/auth/me", {
    method: "PATCH",
    body: profile,
    token,
  });
}
```

The full Profile screen comes next in Stage 16C.

## Test Coverage

`server/tests/authCurrentUser.test.js` now covers:

- updating name
- updating planning priority
- updating both fields together
- safe response data with no password fields
- empty update body validation
- unknown field validation
- invalid planning priority validation
- blank name validation
- too-long name validation
- missing token behavior
- invalid token behavior
- deleted-user token behavior
- signed-in-user ownership isolation

## Acceptance Criteria

Stage 16B is complete when:

- `PATCH /api/auth/me` exists
- route requires authentication
- route validates supported profile fields
- route rejects empty and unknown-field bodies
- service updates only the signed-in user's row
- response returns safe user data
- deleted-user tokens behave as invalid sessions
- backend tests cover success, validation, auth, and ownership behavior
- server test suite passes
- Prettier check passes for touched files

## Next Stage

Stage 16C should enable the Profile nav item and add the frontend Profile preferences screen for editing `name` and `planningPriority` while keeping email read-only.
