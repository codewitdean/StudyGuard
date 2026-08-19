# Stage 8C: Register Endpoint

## Goal

The goal of Stage 8C is to build the first real authentication endpoint:

```http
POST /api/auth/register
```

A student can send their name, email, and password. The backend validates the input, hashes the password, saves the user, creates a JWT, and returns safe user data.

This stage does not build login yet. Login comes in Stage 8D.

## What This Endpoint Solves

StudyGuard stores private academic data. Before a student can create courses or coursework, the app needs a user account to own that data.

Registration creates that owner.

## Files Added or Changed

### `server/src/validators/authValidators.js`

Defines the Zod schema for registration.

The register request must include:

- `name`
- `email`
- `password`

The validator trims the name, lowercases the email, checks email format, and limits password length for bcrypt.

### `server/src/services/authService.js`

Contains the registration business logic.

It:

1. Checks whether the email already exists.
2. Hashes the password.
3. Inserts the user with parameterized SQL.
4. Creates a JWT.
5. Returns safe user data.

The service does not return `password_hash`.

### `server/src/controllers/authController.js`

Handles the HTTP response for registration.

The controller calls the service and sends:

```json
{
  "success": true,
  "data": {
    "user": {},
    "token": "..."
  }
}
```

### `server/src/routes/authRoutes.js`

Defines the route:

```text
POST /register
```

Because the route is mounted at `/api/auth`, the full URL is:

```http
POST /api/auth/register
```

### `server/src/app.js`

Mounts auth routes with:

```js
app.use("/api/auth", authRoutes);
```

It also now uses shared JSON error handlers.

### `server/src/utils/httpErrors.js`

Defines small HTTP error helpers.

For this stage, registration uses `409 Conflict` when an email is already registered.

### `server/src/utils/asyncHandler.js`

Wraps async controller functions so thrown errors go to Express error handling.

Without this wrapper, async errors can be awkward to handle repeatedly in every route.

### `server/src/middleware/errorHandler.js`

Returns consistent JSON for unknown routes and unexpected errors.

### `server/src/database/db.js`

The database helper is now lazy.

That means importing the app does not connect to PostgreSQL immediately. The connection is created only when code calls `query`.

### `server/tests/authRegister.test.js`

Tests the registration endpoint against PostgreSQL.

The tests use throwaway emails that start with `register-test-` and clean those users before and after running.

## Request Flow

```text
Client
-> POST /api/auth/register
-> authRoutes
-> validateRequest(registerSchema)
-> authController.register
-> authService.registerUser
-> query checks for existing email
-> hashPassword hashes the password
-> query inserts the user
-> createAuthToken creates a JWT
-> authController returns 201 JSON
-> Client receives user and token
```

## Request Body

```json
{
  "name": "Maya Chen",
  "email": "maya@example.com",
  "password": "correct-password"
}
```

## Success Response

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
      "planningPriority": "balance_deadlines_wellbeing",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "token": "jwt-token"
  }
}
```

## Error Responses

Validation failure:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed.",
    "details": []
  }
}
```

Duplicate email:

```json
{
  "success": false,
  "error": {
    "message": "Email is already registered."
  }
}
```

Unexpected server error:

```json
{
  "success": false,
  "error": {
    "message": "Internal server error."
  }
}
```

## Important Security Choices

### We Hash Passwords

The raw password is never stored.

The database stores a bcrypt hash in `password_hash`.

### We Return Safe User Data

The API response never includes:

- `password`
- `password_hash`

### We Lowercase Email

The validator lowercases email before the service uses it.

That helps prevent duplicate accounts like:

```text
Maya@Example.com
maya@example.com
```

### We Use Parameterized SQL

The insert query uses placeholders:

```sql
VALUES ($1, $2, $3)
```

The values are passed separately.

That protects against SQL injection.

## Tests

The Stage 8C tests prove:

- A valid request creates a user
- The password is stored as a hash
- The API response does not leak the password or hash
- Email is normalized to lowercase
- Missing required fields return `400`
- Invalid email returns `400`
- Short password returns `400`
- Duplicate email returns `409`

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
curl -i -X POST http://127.0.0.1:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maya Chen","email":"maya@example.com","password":"correct-password"}'
```

## Stage 8C Acceptance Criteria

Stage 8C is complete when:

- `POST /api/auth/register` exists
- Request validation works
- Passwords are hashed before storage
- Duplicate emails return `409`
- The response includes a JWT
- The response excludes password data
- Register tests pass
- Existing health tests still pass
- You approve moving to Stage 8D

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
- Stage 8F: Frontend auth forms and token storage - not started

## Understanding Check

Before Stage 8D, make sure you can answer these:

1. Why does validation happen before the controller calls the service?
2. Why does the service check for an existing email before inserting?
3. Why does the API return the user but not `password_hash`?
4. What does the token let the frontend do next?
