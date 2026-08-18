# Stage 7: Basic Express Server and Health Endpoint

## Goal

The goal of Stage 7 is to confirm that StudyGuard has a basic Express API server and a health endpoint.

This stage was implemented early during Stage 4 because request and response fundamentals are easier to understand with a real endpoint.

This document exists so the project history stays easy to follow.

## What Stage 7 Covers

Stage 7 covers:

- Starting the Express backend
- Separating the app from the server listener
- Creating one simple API route
- Returning JSON from the backend
- Returning JSON for unknown routes
- Testing the endpoint with Supertest

## Files From This Stage

`server/src/app.js`

Creates the Express app, configures middleware, mounts routes, and handles unknown routes.

`server/src/server.js`

Starts the app on a host and port.

`server/src/routes/healthRoutes.js`

Defines the health route.

`server/src/controllers/healthController.js`

Sends the health response.

`server/tests/health.test.js`

Tests the health endpoint and JSON 404 behavior.

## Endpoint

```http
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "studyguard-api",
    "timestamp": "2026-08-17T00:00:00.000Z"
  }
}
```

The timestamp changes on every request.

## Request Flow

```text
Client -> Express app -> Route -> Controller -> Response -> Client
```

For the health endpoint:

```text
Client sends GET /api/health
Express receives the request
Express matches /api/health
healthRoutes runs getHealth
getHealth sends JSON
Client receives 200 OK
```

## Commands

Run the backend:

```bash
npm run dev:server
```

Test the endpoint manually:

```bash
curl -i http://127.0.0.1:4000/api/health
```

Run backend tests:

```bash
npm run test:server
```

## Stage 7 Acceptance Criteria

Stage 7 is complete when:

- The backend server starts.
- `GET /api/health` returns JSON.
- Unknown routes return JSON 404 responses.
- The health endpoint has an automated test.
- You understand the difference between `app.js`, `server.js`, route files, and controller files.

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - complete
- Stage 5: PostgreSQL and database fundamentals - complete
- Stage 6: Database schema and migrations - complete
- Stage 7: Basic Express server and health endpoint - complete
- Stage 8A: Authentication API design - in progress

## Understanding Check

Before continuing auth implementation, make sure you can answer these:

1. Why do tests import `app.js` instead of `server.js`?
2. What does `GET /api/health` prove about the backend?
3. Why should unknown API routes return JSON?
