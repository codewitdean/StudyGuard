# Stage 8F: Frontend Auth Forms and Token Storage

## Goal

The goal of Stage 8F is to connect the React frontend to the authentication API we built in Stages 8C, 8D, and 8E.

The frontend can now:

- Register a student
- Log in a student
- Store the JWT in the browser
- Restore the session after refresh
- Ask the backend for the current user
- Sign out by removing the stored token

## What This Stage Teaches

Until now, we tested auth mostly through backend tests and curl.

This stage shows the browser side of the same flow:

```text
React form
-> fetch POST /api/auth/login or /api/auth/register
-> backend returns user and token
-> frontend stores token
-> frontend sends Authorization: Bearer <token>
-> backend returns GET /api/auth/me
-> frontend displays the signed-in user
```

## Files Added or Changed

### `client/src/api/authApi.js`

Contains the frontend `fetch` functions for auth requests.

It exports:

- `registerStudent`
- `loginStudent`
- `getCurrentStudent`

The API base URL defaults to:

```text
http://127.0.0.1:4000
```

A deployed frontend can override that with `VITE_API_BASE_URL`.

### `client/src/utils/authStorage.js`

Contains the browser token storage helpers.

It exports:

- `getStoredAuthToken`
- `storeAuthToken`
- `clearStoredAuthToken`

The token is stored under this key:

```text
studyguard.authToken
```

### `client/.env.example`

Documents the frontend API URL variable:

```bash
VITE_API_BASE_URL=http://127.0.0.1:4000
```

### `client/src/App.jsx`

Replaces the static dashboard shell with an auth-aware app.

The app has two main states:

- signed out: shows login/register forms
- signed in: shows the dashboard shell and current user profile

## Frontend Auth Flow

### Register

```text
Student fills name, email, and password
-> frontend calls registerStudent
-> POST /api/auth/register
-> backend hashes password and creates user
-> backend returns user and token
-> frontend stores token
-> dashboard appears
```

### Login

```text
Student fills email and password
-> frontend calls loginStudent
-> POST /api/auth/login
-> backend checks bcrypt password hash
-> backend returns user and token
-> frontend stores token
-> dashboard appears
```

### Restore Session

```text
App loads
-> frontend checks localStorage for studyguard.authToken
-> if a token exists, frontend calls GET /api/auth/me
-> valid token returns the current user
-> invalid token is removed
```

### Sign Out

```text
Student clicks Sign Out
-> frontend removes studyguard.authToken
-> frontend clears the current user
-> login/register screen appears
```

## Important Security Notes

### The Frontend Never Stores Passwords

Passwords are sent only during register or login.

The frontend stores the JWT, not the password.

### The Token Is A Bearer Credential

Whoever has the token can make authenticated requests until it expires.

That is why the frontend removes the token on sign out and removes it when `/me` says the session is invalid.

### Local Storage Is Beginner-Friendly, Not Perfect

For this MVP, `localStorage` keeps the authentication flow easy to inspect and understand.

A future production hardening step could move auth to HTTP-only cookies. That would reduce token exposure to injected JavaScript, but it adds cookie, CSRF, and deployment concepts.

## API Calls From The Frontend

Register:

```js
registerStudent({ name, email, password });
```

Login:

```js
loginStudent({ email, password });
```

Current user:

```js
getCurrentStudent(token);
```

## Commands

Run the backend:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev JWT_SECRET=replace-with-a-long-random-secret npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Run backend tests:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run test:server
```

Build the frontend:

```bash
npm run build --workspace client
```

## Stage 8F Acceptance Criteria

Stage 8F is complete when:

- The frontend has register and login forms
- Register calls `POST /api/auth/register`
- Login calls `POST /api/auth/login`
- The JWT is stored after successful auth
- The app restores a saved session with `GET /api/auth/me`
- Sign out clears the token and user state
- API errors display in the UI
- Frontend build passes
- Existing backend tests still pass
- You approve moving to Stage 9A

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

Before Stage 9A, make sure you can answer these:

1. Why does the frontend store the token after login or register?
2. Why does the frontend call `/api/auth/me` after a refresh?
3. Why does sign out only need to remove the token in this JWT MVP?
4. Why is localStorage easy to learn but not the strongest production option?
