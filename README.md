# StudyGuard

StudyGuard is a full-stack academic workload and study-planning application for individual students.

The project is being built gradually so each backend concept is understandable before we add the next feature.

## Current Stage

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - complete
- Stage 5: PostgreSQL and database fundamentals - complete
- Stage 6: Database schema and migrations - complete
- Stage 7: Basic Express server and health endpoint - complete
- Stage 8A: Authentication API design - in progress

## Project Structure

```text
StudyGuard/
  client/   React + Vite frontend
  server/   Node.js + Express backend API
  docs/     Planning and learning notes
```

## Commands

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:client
```

Run the backend:

```bash
npm run dev:server
```

Test the backend:

```bash
npm run test:server
```

Run database migrations:

```bash
npm run db:migrate
```

Format files:

```bash
npm run format
```

## Learning Approach

We will build one stage at a time. The backend is the main learning focus, so API design, validation, authentication, SQL, testing, and scheduling logic will be introduced carefully as the project grows.
