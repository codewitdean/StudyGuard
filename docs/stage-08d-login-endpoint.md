# Stage 8D: Login Endpoint

## Goal

The goal of Stage 8D is to add the second authentication endpoint:

```http
POST /api/auth/login
```

A student can send their email and password. The backend validates the request, finds the user, compares the password with the stored bcrypt hash, creates a JWT, and returns safe user data.

## Why Login Is Separate From Register

Registration creates a new user account.

Login proves that an existing user knows the correct password for an account.

Both endpoints return the same kind of response:

- safe user data
- a JWT the frontend can store and send with future protected requests

## Files Added or Changed

### `server/src/validators/authValidators.js`

Adds `loginSchema`.

The login request must include:

- `email`
- `password`

The email is trimmed, checked, and normalized to lowercase before the service uses it.

### `server/src/services/authService.js`

Adds `loginUser`.

It:

1. Finds the user by email.
2. Returns the same `401` message if the email does not exist.
3. Compares the submitted password against `password_hash`.
4. Returns the same `401` message if the password is wrong.
5. Creates a JWT when the credentials are valid.
6. Returns safe user data without password fields.

### `server/src/controllers/authController.js`

Adds the `login` controller.

The controller calls the service and sends the HTTP response.

### `server/src/routes/authRoutes.js`

Adds the route:

```text
POST /login
```

Because the router is mounted at `/api/auth`, the full URL is:

```http
POST /api/auth/login
```

### `server/src/utils/httpErrors.js`

Adds the `unauthorized` helper for `401 Unauthorized` responses.

### `server/tests/authLogin.test.js`

Adds endpoint tests for valid login, email normalization, wrong password, unknown email, missing fields, and invalid email.

## Request Flow

```text
Client
-> POST /api/auth/login
-> authRoutes
-> validateRequest(loginSchema)
-> authController.login
-> authService.loginUser
-> query finds the user by email
-> comparePasswords checks bcrypt hash
-> createAuthToken creates a JWT
-> authController returns 200 JSON
-> Client receives user and token
```

## Request Body

```json
{
  "email": "maya@example.com",
  "password": "correct-password"
}
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

Wrong email or password:

```json
{
  "success": false,
  "error": {
    "message": "Invalid email or password."
  }
}
```

## Important Security Choices

### Use One Login Error Message

The API returns the same message for an unknown email and a wrong password:

```text
Invalid email or password.
```

That avoids telling attackers which emails are registered.

### Compare Passwords With Bcrypt

The backend never compares raw passwords to raw stored passwords.

Instead, it uses bcrypt to compare the submitted password with the stored hash.

### Return Safe User Data

The login response does not include:

- `password`
- `password_hash`

### Keep Login Password Validation Simple

Registration requires at least 8 characters because we are creating a password.

Login only requires a non-empty password because a wrong password should usually become a credential failure, not a password-strength validation failure.

## Tests

The Stage 8D tests prove:

- Valid credentials return `200`
- The response includes a token
- The response includes safe user data
- Email is normalized before lookup
- Wrong password returns `401`
- Unknown email returns the same `401` message
- Missing fields return `400`
- Invalid email returns `400`

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
curl -i -X POST http://127.0.0.1:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"maya@example.com\",\"password\":\"correct-password\"}"
```

## Stage 8D Acceptance Criteria

Stage 8D is complete when:

- `POST /api/auth/login` exists
- Login request validation works
- Passwords are checked with bcrypt
- Wrong password returns `401`
- Unknown email returns `401`
- Both credential failures use the same error message
- The response includes a JWT
- The response excludes password data
- Login tests pass
- Existing auth and health tests still pass
- You approve moving to Stage 8E

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

Before Stage 8E, make sure you can answer these:

1. Why should unknown email and wrong password return the same message?
2. Why does login use bcrypt comparison instead of hashing the submitted password directly and comparing strings?
3. Why does the response include a token?
4. What should the frontend do with the token after login?
