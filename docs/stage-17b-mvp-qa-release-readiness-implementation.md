# Stage 17B: MVP QA And Release Readiness Implementation

## Goal

Stage 17B executes the MVP QA and release-readiness checklist designed in Stage 17A.

This pass completed environment checks, migrations, automated verification, local smoke checks, an auth/profile API smoke test, and privacy checks.

A full browser click-through was not completed in this agent environment because no browser automation package or browser binary was available. The local app is running and ready for manual browser QA.

## Readiness Status

Current status:

```text
Automation ready, browser QA pending.
```

The MVP is not final-release signed off until the manual browser checklist from Stage 17A is completed.

## Environment Checks

Checked local files:

```text
server/.env present
client/.env present
```

Checked examples:

- `server/.env.example` includes `PORT`, `HOST`, `CLIENT_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN`
- `client/.env.example` includes `VITE_API_BASE_URL`

Result: pass.

## Migration Check

Command:

```bash
npm run db:migrate
```

Result:

```text
Skipped migration: 001_create_core_schema.sql
Database migrations complete.
```

Result: pass.

## Automation Checks

### Format Check

Initial command:

```bash
npm run format:check
```

Initial result: failed.

Failure:

```text
databasetest/main.js
```

Fix applied:

- formatted `databasetest/main.js`
- removed a hardcoded local database password
- changed the script to use `PGHOST`, `PGUSER`, `PGPORT`, `PGPASSWORD`, and `PGDATABASE`
- made the script close the database client after connecting

Final command:

```bash
npm run format:check
```

Final result:

```text
All matched files use Prettier code style!
```

Result: pass after fix.

### Backend Tests

Command:

```bash
npm run test:server
```

Result:

```text
Test Files  11 passed (11)
Tests  111 passed (111)
```

Result: pass.

### Client Build

Command:

```bash
npm run build --workspace client
```

Result:

```text
built in 201ms
```

Result: pass.

## Local Smoke Checks

The backend was restarted from the current code before smoke testing.

Backend URL:

```text
http://127.0.0.1:4000
```

Frontend URL:

```text
http://127.0.0.1:5173/
```

Smoke checks:

```bash
curl -s -o /tmp/studyguard-health.txt -w "%{http_code}" http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:5173/
```

Results:

- backend `/api/health`: `200`
- frontend root: `200 OK`

Result: pass.

## API Smoke Check

Ran a small API smoke flow against the local backend:

1. register temporary QA user
2. update profile with `PATCH /api/auth/me`
3. read current profile with `GET /api/auth/me`
4. verify updated name and planning priority persisted
5. delete temporary QA user from local database

Result:

```text
auth/profile smoke passed
```

Result: pass.

## Privacy And Setup Checks

Checked `.env` ignore status:

```bash
git check-ignore -v server/.env client/.env
```

Result:

```text
.gitignore:5:.env server/.env
.gitignore:5:.env client/.env
```

Result: pass.

Checked for the removed hardcoded password:

```bash
rg -n "thenewman" . -g '!node_modules' -g '!client/dist'
```

Result: no matches.

Result: pass.

Checked `password_hash` references in source/docs:

- expected in auth service SQL
- expected in database migration
- expected in docs explaining password hash privacy
- backend tests already verify auth responses do not include password data

Result: pass.

## Browser QA Status

Browser automation availability check:

```text
playwright unavailable
puppeteer unavailable
no chromium/google-chrome/playwright binary found
```

Result: browser click-through not executed by this agent.

Manual browser QA still needs to cover the Stage 17A checklist:

- Auth
- Profile
- Courses
- Coursework
- Availability
- Study Plan
- Recommendations
- Progress
- Dashboard
- negative form/error states
- keyboard/focus/layout checks

## Defects Found And Fixed

### 1. Formatting Failure

File:

```text
databasetest/main.js
```

Problem:

- did not pass Prettier formatting

Fix:

- formatted file with Prettier

Status: fixed.

### 2. Hardcoded Database Password

File:

```text
databasetest/main.js
```

Problem:

- contained a hardcoded local database password

Fix:

- replaced hardcoded connection settings with environment-variable based config
- removed the password literal from the tracked file

Status: fixed.

## Known Limitations Remaining

- full manual browser QA is pending
- no frontend automated browser tests yet
- no deployed production target yet
- no email-change flow
- no password-change flow
- no account deletion UI
- no timezone preference
- no notification settings
- no custom planning-rule editor
- recommendations approval records decisions but does not yet mutate study plans automatically

## Commands Run

```bash
npm run db:migrate
npm run format:check
npm run test:server
npm run build --workspace client
npx prettier --write databasetest/main.js
npm run format:check
```

Additional smoke/privacy checks:

```bash
curl -s -o /tmp/studyguard-health.txt -w "%{http_code}" http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:5173/
git check-ignore -v server/.env client/.env
rg -n "thenewman" . -g '!node_modules' -g '!client/dist'
```

## Next Stage

Stage 17C should complete the manual browser QA click-through and produce final MVP sign-off or a defect list for fixes.
