# Stage 16A: Profile Preferences API Design

## Goal

The goal of Stage 16A is to design the Profile preferences API before implementation.

StudyGuard already has a disabled Profile nav item, and the user table already stores the first editable profile preferences needed for the MVP:

- `name`
- `email`
- `planning_priority`

Stage 16A defines the backend contract for updating safe profile preferences. The implementation comes in Stage 16B.

## Current State

The backend already supports:

```http
GET /api/auth/me
```

That route returns the signed-in student using the verified token.

Current safe user response shape:

```json
{
  "user": {
    "id": "user-id",
    "name": "Maya Chen",
    "email": "maya@example.com",
    "planningPriority": "balance_deadlines_wellbeing",
    "createdAt": "2026-08-19T12:00:00.000Z",
    "updatedAt": "2026-08-19T12:00:00.000Z"
  }
}
```

The frontend can refresh this profile today, but it cannot edit profile fields yet.

## Existing Database Support

No migration is required for the Stage 16B MVP.

The `users` table already has:

- `id`
- `name`
- `email`
- `password_hash`
- `planning_priority`
- `created_at`
- `updated_at`

Relevant constraints:

- `name` must be 1 to 120 trimmed characters
- `email` must be lowercase and unique
- `planning_priority` must be one of:
  - `meet_deadlines`
  - `prevent_burnout`
  - `balance_deadlines_wellbeing`
  - `custom`

## Design Decision

Use the existing auth profile path:

```http
PATCH /api/auth/me
```

This keeps the current-user read and update operations together:

- `GET /api/auth/me` reads the signed-in student
- `PATCH /api/auth/me` updates the signed-in student's editable profile preferences

A separate `/api/profile` route is not needed for the MVP.

## Non-Goals For Stage 16B

Stage 16B should not include:

- email change
- password change
- account deletion
- timezone preferences
- notification preferences
- avatar upload
- custom planning rules

Reasoning:

- email changes should consider token reissue, duplicate email conflicts, and possible password confirmation
- password changes should require current password verification
- timezone preferences need a migration and scheduling implications
- custom planning rules need their own product pass

## Endpoint: Update Current User Preferences

```http
PATCH /api/auth/me
```

Authentication required: yes.

Headers:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:

```json
{
  "name": "Maya C.",
  "planningPriority": "prevent_burnout"
}
```

All fields are optional individually, but at least one supported field must be provided.

Allowed fields:

- `name`
- `planningPriority`

Unknown fields should be rejected with `400 Bad Request` so clients do not think unsupported fields were changed.

### Validation Rules

`name`:

- optional
- string
- trimmed before storage
- 1 to 120 characters after trimming

`planningPriority`:

- optional
- one of:
  - `meet_deadlines`
  - `prevent_burnout`
  - `balance_deadlines_wellbeing`
  - `custom`

Body-level validation:

- request body must be an object
- at least one supported field must be provided
- unknown keys are not allowed

### Success Response

Status:

```text
200 OK
```

Body:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "name": "Maya C.",
      "email": "maya@example.com",
      "planningPriority": "prevent_burnout",
      "createdAt": "2026-08-19T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z"
    }
  }
}
```

The response must never include:

- `password_hash`
- raw password values
- private data from other tables

### Error Responses

Missing token:

```text
401 Unauthorized
```

Invalid or expired token:

```text
401 Unauthorized
```

Token points to a deleted user:

```text
401 Unauthorized
```

Validation failure:

```text
400 Bad Request
```

Unexpected server error:

```text
500 Internal Server Error
```

## Backend Flow

1. `requireAuth` verifies the bearer token.
2. `validateRequest(updateCurrentUserSchema)` validates `body`, `params`, and `query`.
3. Controller calls `updateCurrentUserById(req.user.id, req.validated.body)`.
4. Service builds an update for allowed fields only.
5. SQL updates `users` using `WHERE id = $1`.
6. SQL returns safe user columns.
7. If no row is returned, service treats the session as invalid and returns `401`.
8. Controller responds with `{ user }`.

## Planned Code Changes For Stage 16B

Expected backend files:

- `server/src/validators/authValidators.js`
- `server/src/services/authService.js`
- `server/src/controllers/authController.js`
- `server/src/routes/authRoutes.js`
- `server/tests/authCurrentUser.test.js`

Optional frontend API helper:

- `client/src/api/authApi.js`

No migration is expected.
No new dependency is expected.

## Service Design

Add a service function shaped like:

```js
export async function updateCurrentUserById(userId, updates) {
  // update name and/or planning_priority, then return safe user fields
}
```

The service should map API field names to database column names:

- `planningPriority` -> `planning_priority`

The SQL should return the same safe user columns used by registration, login, and current-user reads.

## Validator Design

Add an update schema shaped like:

```js
export const updateCurrentUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      planningPriority: z
        .enum([
          "meet_deadlines",
          "prevent_burnout",
          "balance_deadlines_wellbeing",
          "custom",
        ])
        .optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one profile field is required.",
    }),
  params: z.object({}),
  query: z.object({}),
});
```

Stage 16B can adjust the exact Zod structure to match the existing `validateRequest` error shape, but the behavior should match this design.

## Route Design

Add the patch route beside the existing current-user route:

```js
router.get("/me", requireAuth, asyncHandler(getCurrentUser));
router.patch(
  "/me",
  requireAuth,
  validateRequest(updateCurrentUserSchema),
  asyncHandler(updateCurrentUser),
);
```

## Frontend Follow-Up

Stage 16B may add the API helper, but the full Profile screen should wait until Stage 16C.

Expected helper:

```js
export function updateCurrentStudent(token, profile) {
  return requestJson("/api/auth/me", {
    method: "PATCH",
    body: profile,
    token,
  });
}
```

Stage 16C should:

- enable the Profile nav item
- show the current profile values
- allow editing `name` and `planningPriority`
- keep email read-only
- update `currentUser` after save
- keep token storage unchanged

## Test Plan For Stage 16B

Add backend tests for:

- valid name update returns updated user
- valid planning priority update returns updated user
- updating both fields returns updated user
- response does not include password data
- empty body returns `400`
- unknown fields return `400`
- invalid planning priority returns `400`
- blank name returns `400`
- name longer than 120 characters returns `400`
- missing token returns `401`
- invalid token returns `401`
- token for deleted user returns `401`
- update does not affect another user

## Acceptance Criteria For Stage 16B

Stage 16B is complete when:

- `PATCH /api/auth/me` exists
- route requires authentication
- route validates supported profile fields
- route rejects empty and unknown-field bodies
- service updates only the signed-in user's row
- response returns safe user data
- deleted-user tokens still behave as invalid sessions
- backend tests cover success, validation, auth, and ownership behavior
- `npm run test --workspace server` passes
- Prettier check passes for touched files
