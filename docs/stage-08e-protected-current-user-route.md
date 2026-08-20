# Stage 8E: Protected Current-User Route

## Goal

The goal of Stage 8E is to add the first protected authentication endpoint:

```http
GET /api/auth/me
```

A student sends a JWT in the `Authorization` header. The backend verifies the token, loads the matching user from PostgreSQL, and returns safe user data.

## Why This Route Matters

After refresh, the frontend may still have a token but no user object in memory.

`GET /api/auth/me` lets the frontend ask:

```text
Who is currently logged in?
```

That route becomes the bridge between login/register and future private StudyGuard data.

## Files Added or Changed

### `server/src/middleware/authMiddleware.js`

The existing `requireAuth` middleware now also checks that the verified JWT has the payload shape we expect.

A valid token must include:

- `sub`: the user ID
- `email`: the user email

If the header is missing or not a bearer token, the middleware returns `401 Authentication required.`

If the token is invalid or expired, the middleware returns `401 Invalid or expired token.`

### `server/src/services/authService.js`

Adds `getCurrentUserById`.

It reads the user from PostgreSQL using the authenticated user ID from the token. The service returns safe user data and never selects or returns `password_hash` for this route.

### `server/src/controllers/authController.js`

Adds the `getCurrentUser` controller.

The controller returns:

```json
{
  "success": true,
  "data": {
    "user": {}
  }
}
```

### `server/src/routes/authRoutes.js`

Adds the protected route:

```text
GET /me
```

Because the route is mounted at `/api/auth`, the full URL is:

```http
GET /api/auth/me
```

The route uses `requireAuth` before the controller runs.

### `server/tests/authCurrentUser.test.js`

Adds endpoint tests for valid tokens, missing headers, malformed headers, invalid tokens, and tokens for deleted users.

## Request Flow

```text
Client
-> GET /api/auth/me
-> Authorization: Bearer <token>
-> authRoutes
-> requireAuth verifies the JWT
-> req.user is attached
-> authController.getCurrentUser
-> authService.getCurrentUserById
-> query loads the user from PostgreSQL
-> authController returns 200 JSON
-> Client receives the current user
```

## Request Headers

```http
Authorization: Bearer jwt-token-here
```

## Success Response

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
      "name": "Maya Chen",
      "email": "maya@example.com",
      "planningPriority": "balance_deadlines_wellbeing",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
}
```

## Error Responses

Missing token:

```json
{
  "success": false,
  "error": {
    "message": "Authentication required."
  }
}
```

Invalid token:

```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired token."
  }
}
```

## Important Security Choices

### Verify First, Then Load From The Database

The token proves the request may belong to a user.

The database lookup proves that the user still exists and gives the backend the freshest safe profile data.

### Do Not Trust Client-Sent User IDs

The client does not send a user ID in the request body or query string.

The backend gets the user ID from the verified JWT payload only.

### Keep Password Data Out

The current-user query does not select `password_hash`.

That makes accidental leaks less likely.

## Tests

The Stage 8E tests prove:

- A valid registration token can load the current user
- A valid login token can load the current user
- The response excludes password data
- Missing authorization headers return `401`
- Non-bearer authorization headers return `401`
- Invalid tokens return `401`
- Tokens for deleted users return `401`

## Commands

Make sure PostgreSQL is running:

```bash
brew services start postgresql@16
```

Run migrations:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run db:migrate
```

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Manual curl test:

```bash
curl -i http://127.0.0.1:4000/api/auth/me \
  -H "Authorization: Bearer jwt-token-here"
```

## Stage 8E Acceptance Criteria

Stage 8E is complete when:

- `GET /api/auth/me` exists
- The route requires `Authorization: Bearer <token>`
- Missing tokens return `401`
- Invalid tokens return `401`
- Valid tokens return the current user
- The user is loaded from PostgreSQL
- The response excludes password data
- Current-user tests pass
- Existing auth and health tests still pass
- You approve moving to Stage 8F

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

Before Stage 8F, make sure you can answer these:

1. Why does the backend read the user ID from the token instead of the request body?
2. Why does the `/me` route load the user from the database after verifying the token?
3. What is the difference between a missing token and an invalid token?
4. How will the frontend use this route after a browser refresh?
