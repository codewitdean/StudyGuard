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
- Stage 13A: Recommendations API design - complete
- Stage 13B: Recommendations CRUD API implementation - complete
- Stage 13C: Frontend recommendations review - complete
- Stage 14A: Progress API design - complete
- Stage 14B: Progress API implementation - complete
- Stage 14C: Frontend progress dashboard - complete
- Stage 15A: Dashboard data integration design - complete
- Stage 15B: Dashboard data integration implementation - complete
- Stage 16A: Profile preferences API design - complete
- Stage 16B: Profile preferences API implementation - complete
- Stage 16C: Frontend profile preferences screen - complete
- Stage 17A: MVP QA and release readiness design - complete
- Stage 17B: MVP QA and release readiness implementation - not started

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

Create local environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The backend needs `server/.env` so `DATABASE_URL` and `JWT_SECRET` are available when you run the API.

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
