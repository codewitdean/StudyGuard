# Stage 3: Technology Setup and Folder Structure

## Goal

The goal of Stage 3 is to create the project structure and install the first tools.

This stage does not build authentication, database tables, or scheduling yet. It gives us a clean place to put those features later.

## Technology Choices

### Frontend

We are using React with Vite.

- React helps us build the user interface as reusable components.
- Vite runs the frontend development server and bundles the app.
- Tailwind CSS gives us utility classes for styling.

### Backend

We are using Node.js with Express.

- Node.js runs JavaScript outside the browser.
- Express helps us build HTTP API routes.
- CORS allows the browser frontend to call the backend during local development.
- dotenv loads environment variables from `.env` files.

### Repository Shape

We are using a two-app workspace:

```text
StudyGuard/
  client/
  server/
  docs/
```

This is still one Git repository, but the frontend and backend are separate programs.

## Files Created

### Root Files

`package.json`

Defines the project as a private npm workspace. It also gives us shortcut commands such as `npm run dev:client` and `npm run dev:server`.

`.gitignore`

Prevents generated files, dependencies, logs, and secrets from being committed.

`.editorconfig`

Keeps basic editor formatting consistent across files.

`.prettierrc.json`

Configures Prettier, which formats code consistently.

`.prettierignore`

Tells Prettier which generated folders and files to skip.

`README.md`

Documents the project purpose, structure, and current commands.

### Frontend Files

`client/package.json`

Defines the frontend app dependencies and scripts.

`client/index.html`

The browser loads this HTML file first. The React app mounts into the `div` with `id="root"`.

`client/vite.config.js`

Configures Vite, React, and Tailwind CSS.

`client/src/main.jsx`

Starts the React app by rendering `App` into the page.

`client/src/App.jsx`

Contains a temporary dashboard shell so we can confirm the frontend runs.

`client/src/index.css`

Loads Tailwind CSS and sets a few basic page defaults.

### Backend Files

`server/package.json`

Defines the backend dependencies and scripts.

`server/.env.example`

Shows which environment variables the backend expects. This file is safe to commit because it does not contain secrets.

`server/src/server.js`

Starts the Express server. It does not define real API features yet.

Backend folders:

- `config`: environment and app configuration
- `controllers`: HTTP request and response logic
- `database`: PostgreSQL connection and SQL helpers
- `middleware`: reusable functions that run before controllers
- `routes`: URL definitions
- `services`: business logic
- `utils`: small reusable helper functions
- `validators`: request validation schemas
- `tests`: backend endpoint and service tests

The `.gitkeep` files exist because Git does not track empty folders.

## Exact Commands

From the project root:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:client
```

Run the backend in a second terminal:

```bash
npm run dev:server
```

Format the project:

```bash
npm run format
```

## What To Look For

When the frontend runs, Vite should print a local URL such as:

```text
http://localhost:5173/
```

When the backend runs, Node should print:

```text
StudyGuard API listening on http://127.0.0.1:4000
```

The backend does not have a health endpoint yet. We will add that when we teach backend request and response fundamentals.

## Important Beginner Concepts

### Frontend and Backend

The frontend runs in the browser. It is responsible for screens, forms, buttons, navigation, and visual feedback.

The backend runs on the server. It is responsible for validation, authentication, database access, scheduling rules, and safe responses.

### npm Package

A `package.json` file describes a JavaScript project. It lists scripts, dependencies, and metadata.

### Dependency

A dependency is code from another package that our app uses. For example, React is a frontend dependency and Express is a backend dependency.

### Workspace

An npm workspace lets one repository contain multiple related packages. Here, the root project manages both `client` and `server`.

### Environment Variable

An environment variable is configuration that can change between development and production. Secrets belong in `.env`, not in Git.

## Stage 3 Acceptance Criteria

Stage 3 is complete when:

- The root project has workspace scripts.
- The frontend folder exists and can run with Vite.
- The backend folder exists and can start an Express server.
- Secret files are ignored by Git.
- The folder structure is documented.
- You can explain why `client` and `server` are separate.

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - not started
- Stage 5: PostgreSQL and database fundamentals - not started
- Stage 6: Database schema and migrations - not started
- Stage 7: Basic Express server and health endpoint - not started
- Stage 8: Registration, login, and protected routes - not started

## Understanding Check

Before Stage 4, make sure you can answer these:

1. What is the difference between `client` and `server`?
2. Why should `.env` files be ignored by Git?
3. What does `package.json` do?
4. Why does the backend need CORS during local development?
