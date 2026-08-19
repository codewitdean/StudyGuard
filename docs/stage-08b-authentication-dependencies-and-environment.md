# Stage 8B: Authentication Dependencies and Environment Setup

## Goal

The goal of Stage 8B is to add the small reusable building blocks that authentication will need before we create real auth routes.

This stage prepares:

- Password hashing
- JWT creation and verification
- Request validation middleware
- Protected-route middleware
- PostgreSQL query helper
- Auth environment variables

This stage does not create `POST /api/auth/register` yet. That comes in Stage 8C.

## Dependencies Added

The server workspace now includes:

- `bcrypt`: hashes and compares passwords
- `jsonwebtoken`: creates and verifies JWTs
- `zod`: validates request data

Installed with:

```bash
npm install bcrypt@6.0.0 jsonwebtoken@9.0.3 zod@4.4.3 --workspace server
```

`bcrypt` has an install script because it includes native code. We verified it works by hashing and comparing a test password.

## Environment Variables

`server/.env.example` now includes:

```text
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
```

`JWT_SECRET` signs tokens. Anyone with the real secret could forge valid tokens, so real secrets must never be committed to Git or placed in frontend code.

`JWT_EXPIRES_IN` controls how long a token remains valid.

## Files Added

### `server/src/database/db.js`

Creates a reusable PostgreSQL connection pool and exports:

- `query(text, params)`
- `closeDatabase()`

The app will use `query` for parameterized SQL such as:

```js
await query("SELECT * FROM users WHERE email = $1", [email]);
```

### `server/src/utils/passwords.js`

Exports:

- `hashPassword(password)`
- `comparePasswords(password, passwordHash)`

Register will hash the password before saving the user.

Login will compare the submitted password with the stored hash.

### `server/src/utils/tokens.js`

Exports:

- `createAuthToken(user)`
- `verifyAuthToken(token)`

The token payload includes the user's email and stores the user ID as `sub`.

### `server/src/middleware/validateRequest.js`

Creates reusable validation middleware for Zod schemas.

If validation fails, the API returns:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed.",
    "details": []
  }
}
```

If validation succeeds, the parsed data is stored on `req.validated`.

### `server/src/middleware/authMiddleware.js`

Exports:

- `requireAuth(req, res, next)`

It checks for:

```http
Authorization: Bearer <token>
```

If the token is valid, it sets:

```js
req.user = {
  id: payload.sub,
  email: payload.email,
};
```

If the token is missing or invalid, it returns `401`.

## Tests Added

`server/tests/authHelpers.test.js` proves:

- Passwords hash correctly
- Correct passwords compare successfully
- Wrong passwords fail comparison
- JWTs can be created and verified
- Missing tokens return `401`
- Invalid tokens return `401`
- Valid tokens set `req.user`
- Validation middleware stores parsed data
- Validation middleware returns JSON errors

## Request Flow Preview

The next stage, registration, will use the helpers like this:

```text
Client sends POST /api/auth/register
-> validateRequest checks the body
-> controller reads req.validated.body
-> service calls hashPassword
-> service uses query to insert user
-> service calls createAuthToken
-> controller returns user and token
```

## Commands

Run backend tests:

```bash
npm run test:server
```

Check the files touched in this stage:

```bash
npx prettier --check server/.env.example server/src/database/db.js server/src/utils/passwords.js server/src/utils/tokens.js server/src/middleware/validateRequest.js server/src/middleware/authMiddleware.js server/tests/authHelpers.test.js docs/stage-08b-authentication-dependencies-and-environment.md
```

## Stage 8B Acceptance Criteria

Stage 8B is complete when:

- Auth dependencies are installed in the server workspace
- JWT environment variables are documented
- Password helpers exist and are tested
- Token helpers exist and are tested
- Validation middleware exists and is tested
- Auth middleware exists and is tested
- No real auth route has been added yet
- You approve moving to Stage 8C

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

## Understanding Check

Before Stage 8C, make sure you can answer these:

1. Why do we hash passwords before storing them?
2. What does the JWT secret protect?
3. What does `requireAuth` add to the request?
4. Why does validation happen before controller logic?
