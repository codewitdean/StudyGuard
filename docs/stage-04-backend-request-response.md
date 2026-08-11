# Stage 4: Backend Request and Response Fundamentals

## Goal

The goal of Stage 4 is to understand what happens when a client asks the backend for something.

We added one tiny endpoint:

```text
GET /api/health
```

This endpoint exists only to prove the backend can receive a request and return JSON.

## Why We Added a Health Endpoint Now

The original stage list placed the health endpoint later, but request and response fundamentals are easier to learn with a real route.

This is a small order improvement:

- Stage 4 now includes the health endpoint.
- Later backend stages can focus on database, validation, auth, and ownership.
- We still are not building a full feature yet.

## The New Request Flow

```text
Client -> Express App -> Route -> Controller -> Response -> Client
```

For this endpoint:

```text
Client sends GET /api/health
Express receives the request
Express checks mounted routes
/api/health matches healthRoutes
router.get("/") runs getHealth
getHealth sends a 200 JSON response
Client receives the response
```

## Files Changed

### `server/src/app.js`

This file creates the Express app.

It is separate from `server/src/server.js` so tests can import the app without opening a network port.

Key responsibilities:

- Create the Express application.
- Enable CORS for the frontend origin.
- Enable JSON request bodies.
- Mount the health route.
- Return a JSON 404 for unknown routes.

### `server/src/server.js`

This file starts the server.

It imports the app from `app.js`, chooses a host and port, and listens for requests.

This separation matters:

- `app.js` describes the backend behavior.
- `server.js` starts the network listener.
- Tests can use `app.js` directly without needing localhost.

### `server/src/routes/healthRoutes.js`

This file defines the health route.

The router says:

```text
GET / -> getHealth
```

Because the router is mounted at `/api/health`, the full path becomes:

```text
GET /api/health
```

### `server/src/controllers/healthController.js`

This file contains the controller function.

A controller receives the request and sends the response.

For now, `getHealth` sends:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "studyguard-api",
    "timestamp": "..."
  }
}
```

### `server/tests/health.test.js`

This test file uses Supertest to call the Express app without starting a real localhost server.

It proves:

- `GET /api/health` returns status code `200`.
- The response is JSON.
- The response follows our `success` and `data` shape.
- Unknown routes return a JSON `404`.

## Important Concepts

### Client

The client is the thing making the request.

In StudyGuard, the client will usually be the React frontend. During development, it can also be a tool like Postman, Bruno, curl, or Supertest.

### Server

The server receives requests, applies backend rules, talks to the database when needed, and sends responses.

### HTTP Method

The HTTP method describes the action.

For now:

```text
GET
```

means "read information."

Later:

- `POST` will create data.
- `PATCH` will update part of a resource.
- `DELETE` will remove a resource.

### Route

A route connects a method and URL to backend code.

Example:

```text
GET /api/health
```

### Controller

A controller handles the request and decides what response to send.

Later, controllers should stay thin. They should call services for business logic instead of doing everything themselves.

### Status Code

A status code tells the client what happened.

In this stage:

- `200` means the request worked.
- `404` means the route does not exist.

### JSON Response

JSON is the data format our API will send to the frontend.

We are starting with a consistent shape:

```json
{
  "success": true,
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "message": "Route not found"
  }
}
```

## Exact Commands

Run the backend:

```bash
npm run dev:server
```

In another terminal, test the health endpoint:

```bash
curl -i http://127.0.0.1:4000/api/health
```

Run the backend tests:

```bash
npm run test:server
```

Check formatting:

```bash
npm run format:check
```

## Expected Manual Response

The health endpoint should return HTTP `200` and a JSON body like:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "studyguard-api",
    "timestamp": "2026-08-11T00:00:00.000Z"
  }
}
```

The timestamp will be different every time.

## Line-by-Line Explanation

### `server/src/app.js`

```js
import cors from "cors";
import express from "express";
import healthRoutes from "./routes/healthRoutes.js";
```

These imports bring in Express, CORS, and our health router.

```js
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
```

This chooses which frontend origin is allowed to call the backend during local development.

```js
const app = express();
```

This creates the Express application.

```js
app.use(cors({ origin: clientOrigin }));
```

This allows the frontend dev server to call the backend.

```js
app.use(express.json());
```

This lets Express read JSON request bodies. The health route does not need a body, but later `POST` and `PATCH` routes will.

```js
app.use("/api/health", healthRoutes);
```

This says every route inside `healthRoutes` starts with `/api/health`.

```js
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
    },
  });
});
```

This catches requests that do not match any route and sends a JSON 404 response.

```js
export default app;
```

This lets other files import the app. Our server imports it to listen for real traffic, and tests import it to make fake requests.

## Stage 4 Acceptance Criteria

Stage 4 is complete when:

- `GET /api/health` returns JSON.
- Unknown routes return JSON 404 responses.
- The app and server startup are separated.
- The health endpoint has an automated test.
- You can explain what a route and controller do.
- You approve moving to Stage 5.

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - complete
- Stage 5: PostgreSQL and database fundamentals - in progress
- Stage 6: Database schema and migrations - not started
- Stage 7: Basic Express server and health endpoint - covered by Stage 4
- Stage 8: Registration, login, and protected routes - not started

## Understanding Check

Before Stage 5, make sure you can answer these:

1. What is an HTTP route?
2. What is the difference between `app.js` and `server.js`?
3. Why can tests import `app.js` without starting a real localhost server?
4. Why should API errors return JSON instead of random HTML?
