# Stage 8A: Authentication API Design

## Goal

The goal of Stage 8A is to design authentication before writing the auth code.

Authentication answers this question:

```text
Who is making this request?
```

Authorization answers a different question:

```text
Is this authenticated user allowed to access this resource?
```

In this stage, we are designing:

- Registration
- Login
- Logout behavior
- Protected profile lookup
- Profile updates
- Account deletion
- JWT authentication middleware
- Validation rules
- Error responses
- Backend tests

No auth implementation is added in this stage.

## Why Auth Comes Next

Most StudyGuard data is private.

Before we build course routes, coursework routes, availability routes, or scheduling routes, the backend needs to know which student owns the request.

That is why auth must come before the rest of the core API.

## Auth Data Already Exists in the Schema

The `users` table already includes:

- `id`
- `name`
- `email`
- `password_hash`
- `planning_priority`
- `created_at`
- `updated_at`

The important security detail:

```text
The database stores password_hash, never the original password.
```

## Auth Dependencies We Will Add Next

In Stage 8B, we will add:

- `bcrypt`: hashes and verifies passwords
- `jsonwebtoken`: creates and verifies JWTs
- `zod`: validates request bodies

We will not install them in this design stage.

## Token Strategy

For the JavaScript MVP, we will use JWT bearer tokens.

The frontend will send protected requests with:

```http
Authorization: Bearer <token>
```

The backend will:

1. Read the `Authorization` header.
2. Confirm it starts with `Bearer `.
3. Verify the JWT signature.
4. Extract the user ID from the token.
5. Attach the authenticated user to `req.user`.
6. Let the controller continue.

### Security Tradeoff

Bearer tokens are beginner-friendly and teach authorization headers clearly.

They are not perfect. If a frontend stores a token in `localStorage`, malicious injected JavaScript could read it during an XSS attack.

For the MVP, we will reduce risk by:

- Keeping token expiration limited
- Never putting secrets in frontend code
- Validating inputs
- Avoiding dangerous HTML rendering
- Returning safe JSON errors

Later, an HTTP-only cookie setup could be more secure, but it adds more concepts.

## JWT Payload

The token should contain only what the backend needs.

Planned payload:

```json
{
  "sub": "user-id-here",
  "email": "student@example.com"
}
```

`sub` means subject. In auth systems, it usually stores the authenticated user's ID.

Do not put private profile data, passwords, grades, courses, or schedule data inside the token.

## Consistent API Response Shape

Successful responses:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "message": "Something went wrong."
  }
}
```

Validation errors may include field details later:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed.",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address."
      }
    ]
  }
}
```

## Endpoint 1: Register

### Method and URL

```http
POST /api/auth/register
```

### Purpose

Create a new student account.

### Authentication Required

No.

The user does not have an account yet.

### Request Body

```json
{
  "name": "Maya Chen",
  "email": "maya@example.com",
  "password": "strong-password-here"
}
```

### Validation Rules

- `name` is required
- `name` must be 1 to 120 characters after trimming
- `email` is required
- `email` must be a valid email format
- `email` must be stored lowercase
- `password` is required
- `password` must be at least 8 characters
- `password` must be at most 72 characters for bcrypt compatibility

### Database Behavior

1. Lowercase the email.
2. Check whether the email already exists.
3. Hash the password.
4. Insert the user into `users`.
5. Return safe user fields only.

### Success Response

Status:

```text
201 Created
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
      "planningPriority": "balance_deadlines_wellbeing"
    },
    "token": "jwt-token"
  }
}
```

### Possible Errors

- `400 Bad Request`: validation failed
- `409 Conflict`: email is already registered
- `500 Internal Server Error`: unexpected server error

### Security Rules

- Never return `password_hash`
- Never log the password
- Store only the hashed password
- Use parameterized SQL

## Endpoint 2: Login

### Method and URL

```http
POST /api/auth/login
```

### Purpose

Authenticate an existing student.

### Authentication Required

No.

### Request Body

```json
{
  "email": "maya@example.com",
  "password": "strong-password-here"
}
```

### Validation Rules

- `email` is required
- `email` must be a valid email format
- `password` is required

### Database Behavior

1. Lowercase the email.
2. Find the user by email.
3. Compare the submitted password with `password_hash`.
4. Create a JWT if the password is correct.
5. Return safe user fields only.

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
      "name": "Maya Chen",
      "email": "maya@example.com",
      "planningPriority": "balance_deadlines_wellbeing"
    },
    "token": "jwt-token"
  }
}
```

### Possible Errors

- `400 Bad Request`: validation failed
- `401 Unauthorized`: email or password is incorrect
- `500 Internal Server Error`: unexpected server error

### Security Rules

For login failure, use a generic message:

```text
Invalid email or password.
```

Do not say:

```text
Email does not exist.
```

That avoids revealing which emails have accounts.

## Endpoint 3: Logout

### Method and URL

```http
POST /api/auth/logout
```

### Purpose

Let the frontend complete a logout flow.

### Authentication Required

No for the MVP.

### Important Concept

With basic stateless JWT auth, the server does not store active sessions.

That means logout mainly happens on the frontend by deleting the token.

The endpoint can still return a clear success response so the frontend has one consistent logout action.

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
    "message": "Logged out successfully."
  }
}
```

### Future Improvement

Later, we could add server-side token invalidation or refresh tokens.

That is more secure, but it is not necessary for the first learning version.

## Endpoint 4: Get Current User

### Method and URL

```http
GET /api/auth/me
```

### Purpose

Return the currently authenticated student's profile.

### Authentication Required

Yes.

### Headers

```http
Authorization: Bearer <token>
```

### Request Body

None.

### Database Behavior

1. Auth middleware verifies JWT.
2. Middleware sets `req.user`.
3. Controller asks service for the current user.
4. Service loads the user by `req.user.id`.
5. Backend returns safe profile data.

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
      "name": "Maya Chen",
      "email": "maya@example.com",
      "planningPriority": "balance_deadlines_wellbeing"
    }
  }
}
```

### Possible Errors

- `401 Unauthorized`: missing, invalid, or expired token
- `404 Not Found`: user no longer exists
- `500 Internal Server Error`: unexpected server error

## Endpoint 5: Update Current User

### Method and URL

```http
PATCH /api/auth/me
```

### Purpose

Update basic profile fields for the authenticated student.

### Authentication Required

Yes.

### Headers

```http
Authorization: Bearer <token>
```

### Request Body

```json
{
  "name": "Maya C.",
  "planningPriority": "prevent_burnout"
}
```

### Validation Rules

- `name` is optional
- `name` must be 1 to 120 characters after trimming if provided
- `planningPriority` is optional
- `planningPriority` must be one of:
  - `meet_deadlines`
  - `prevent_burnout`
  - `balance_deadlines_wellbeing`
  - `custom`
- At least one allowed field must be provided

### Database Behavior

1. Auth middleware verifies JWT.
2. Service updates only allowed fields.
3. SQL uses `WHERE id = $1`.
4. Backend returns the updated safe user fields.

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
      "planningPriority": "prevent_burnout"
    }
  }
}
```

### Possible Errors

- `400 Bad Request`: validation failed
- `401 Unauthorized`: missing, invalid, or expired token
- `404 Not Found`: user no longer exists
- `500 Internal Server Error`: unexpected server error

## Endpoint 6: Delete Current User

### Method and URL

```http
DELETE /api/auth/me
```

### Purpose

Delete the authenticated student's account and associated private data.

### Authentication Required

Yes.

### Headers

```http
Authorization: Bearer <token>
```

### Request Body

```json
{
  "password": "strong-password-here"
}
```

### Why Require Password Again?

Account deletion is destructive.

Requiring the current password makes accidental or stolen-token deletion less likely.

### Database Behavior

1. Auth middleware verifies JWT.
2. Service loads the user and password hash.
3. Service compares the submitted password.
4. Service deletes the user row.
5. PostgreSQL cascades related private data.

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
    "deleted": true
  }
}
```

### Possible Errors

- `400 Bad Request`: password missing
- `401 Unauthorized`: missing, invalid, or expired token
- `403 Forbidden`: password confirmation failed
- `404 Not Found`: user no longer exists
- `500 Internal Server Error`: unexpected server error

## Planned File Structure

The auth implementation will add or fill these files:

```text
server/src/routes/authRoutes.js
server/src/controllers/authController.js
server/src/services/authService.js
server/src/middleware/authMiddleware.js
server/src/validators/authValidators.js
server/src/database/db.js
server/src/utils/tokens.js
server/src/utils/passwords.js
server/tests/auth.test.js
```

### Why These Files Exist

`authRoutes.js`

Defines auth URLs and connects them to controller functions.

`authController.js`

Handles HTTP details: request body, status codes, and JSON responses.

`authService.js`

Handles auth business logic: registering, logging in, updating profiles, and deleting accounts.

`authMiddleware.js`

Verifies JWTs before protected routes.

`authValidators.js`

Defines Zod schemas for request validation.

`db.js`

Creates a reusable PostgreSQL query helper.

`tokens.js`

Creates and verifies JWTs.

`passwords.js`

Hashes and compares passwords.

`auth.test.js`

Tests the auth endpoints.

## Request Flow: Register

```text
Client
-> POST /api/auth/register
-> authRoutes
-> validate register body
-> authController.register
-> authService.register
-> bcrypt hashes password
-> PostgreSQL inserts user
-> authService creates JWT
-> authController sends 201 JSON
-> Client stores token
```

## Request Flow: Protected Route

```text
Client sends Authorization header
-> authMiddleware reads token
-> jsonwebtoken verifies token
-> middleware sets req.user
-> route continues
-> controller uses req.user.id
-> service queries rows owned by that user
-> controller returns JSON
```

## Environment Variables

We will add these to `server/.env.example` in the implementation stage:

```text
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
```

### Why `JWT_SECRET` Matters

The JWT secret signs tokens.

If someone has the secret, they can forge tokens.

Rules:

- Never commit a real secret
- Never put the secret in frontend code
- Use a long random value
- Use different secrets for development and production

## Test Plan

### Register Tests

- Successful registration returns `201`
- Response includes safe user data
- Response includes token
- Response never includes `password_hash`
- Missing name returns `400`
- Invalid email returns `400`
- Short password returns `400`
- Duplicate email returns `409`

### Login Tests

- Successful login returns `200`
- Valid password returns token
- Wrong password returns `401`
- Unknown email returns generic `401`
- Missing fields return `400`
- Response never includes `password_hash`

### Protected Route Tests

- `GET /api/auth/me` without token returns `401`
- Invalid token returns `401`
- Valid token returns current user

### Profile Update Tests

- Valid update returns updated user
- Empty body returns `400`
- Invalid planning priority returns `400`
- Missing token returns `401`

### Delete Account Tests

- Missing token returns `401`
- Missing password returns `400`
- Wrong password returns `403`
- Correct password deletes account
- Deleted user can no longer log in

## Stage 8A Acceptance Criteria

Stage 8A is complete when:

- Auth endpoints are defined
- Request bodies are defined
- Response shapes are defined
- Validation rules are defined
- Status codes are defined
- Security tradeoffs are explained
- Test cases are planned
- No auth code has been implemented yet
- You approve moving to Stage 8B

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

Before Stage 8B, make sure you can answer these:

1. What is the difference between authentication and authorization?
2. Why do we store `password_hash` instead of `password`?
3. Why should a failed login use a generic error message?
4. What does the `Authorization: Bearer <token>` header do?
