# Stage 17C: Manual Browser QA And Final MVP Sign-Off

## Goal

Stage 17C is the final human browser click-through before StudyGuard can be called MVP-ready.

The agent environment could not execute this stage end to end because browser automation is unavailable:

```text
playwright unavailable
puppeteer unavailable
no chromium/google-chrome/playwright binary found on PATH
```

The local app and backend are running and ready for manual QA.

## Current Status

```text
Manual QA in progress, user sign-off pending.
```

Do not mark the MVP fully signed off until the checklist below is completed in a real browser.

## Local URLs

Frontend:

```text
http://127.0.0.1:5173/
```

Backend health:

```text
http://127.0.0.1:4000/api/health
```

## Already Verified By Automation

From Stage 17B:

- migrations run cleanly
- backend tests pass
- client production build passes
- full Prettier check passes
- frontend root responds with `200 OK`
- backend `/api/health` responds with `200`
- auth/profile API smoke test passes
- `.env` files are gitignored
- hardcoded local database password was removed from `databasetest/main.js`

## Suggested Manual QA Account

Use a local-only test account. Suggested values:

```text
Name: Stage QA Student
Email: stage17c-manual-<today-or-random>@example.com
Password: correct-password
```

Use a unique email so registration does not collide with prior QA runs.

## Manual Sign-Off Checklist

### 1. Auth

- [ ] Register a new account.
- [ ] Confirm registration lands on Dashboard.
- [ ] Sign out.
- [ ] Log back in with the same account.
- [ ] Refresh the page and confirm the session restores.
- [ ] Try a wrong password and confirm a visible error appears.

Notes:

```text

```

### 2. Profile

- [ ] Open Profile from the sidebar.
- [ ] Confirm email is visible and not editable.
- [ ] Update the name.
- [ ] Confirm sidebar name and initials update after save.
- [ ] Update planning priority.
- [ ] Confirm reset clears unsaved edits.
- [ ] Confirm Save disables when there are no changes.

Notes:

```text

```

### 3. Courses

- [ ] Create a course.
- [ ] Edit course fields.
- [ ] Archive the course.
- [ ] Restore the course.
- [ ] Confirm active/archived/all filters work.
- [ ] Delete a test course.

Notes:

```text

```

### 4. Coursework

- [ ] Create coursework linked to a course.
- [ ] Create coursework with no course.
- [ ] Edit due date, priority, difficulty, estimate, and status.
- [ ] Mark coursework completed.
- [ ] Confirm status/due/course/type filters work.
- [ ] Delete a test coursework item.

Notes:

```text

```

### 5. Availability

- [ ] Create weekly availability.
- [ ] Try overlapping weekly availability and confirm a controlled error appears.
- [ ] Edit weekly availability.
- [ ] Delete weekly availability.
- [ ] Create an unavailable exception.
- [ ] Create an extra-available exception.
- [ ] Edit and delete exceptions.

Notes:

```text

```

### 6. Study Plan

- [ ] Generate a draft study plan from coursework and availability.
- [ ] Confirm study blocks render.
- [ ] Confirm warnings/explanations render when present.
- [ ] Approve a draft plan.
- [ ] Archive a plan.
- [ ] Confirm Dashboard reflects current plan/workload status.

Notes:

```text

```

### 7. Recommendations

- [ ] Create a recommendation.
- [ ] Edit recommendation JSON.
- [ ] Approve a pending recommendation.
- [ ] Reject another recommendation.
- [ ] Delete a recommendation.
- [ ] Confirm review/approved/rejected/all filters work.

Notes:

```text

```

### 8. Progress

- [ ] Log a study session.
- [ ] Edit the study session.
- [ ] Delete the study session.
- [ ] Confirm progress summary updates.
- [ ] Confirm date filters work.
- [ ] Confirm recent sessions render related coursework or general study labels.

Notes:

```text

```

### 9. Dashboard

- [ ] Confirm open tasks count uses real coursework.
- [ ] Confirm due today count uses local date grouping.
- [ ] Confirm study blocks come from the current study plan.
- [ ] Confirm upcoming deadlines show real coursework.
- [ ] Confirm weekly workload uses progress and plan data.
- [ ] Confirm recommendation count links to Recommendations.
- [ ] Confirm Refresh Data reloads dashboard data.
- [ ] Confirm workload badge reflects the selected plan overload status.

Notes:

```text

```

### 10. Error And Empty States

- [ ] Empty form submissions show visible validation errors.
- [ ] Invalid UUID/filter values in advanced inputs show controlled errors.
- [ ] API unavailable state shows a connection error.
- [ ] Expired or invalid sessions return to signed-out state.
- [ ] Empty lists render useful empty states instead of blank panels.

Notes:

```text

```

### 11. Accessibility And Layout

- [ ] Sidebar and forms can be reached by keyboard tabbing.
- [ ] Focus states are visible.
- [ ] Inputs have visible labels.
- [ ] Error messages are readable.
- [ ] Buttons disable during save/load states.
- [ ] Tables remain usable at narrow widths.
- [ ] Text does not overlap on mobile width.

Notes:

```text

```

## Dummy QA Data

A reusable dummy-data seed is available for manual QA:

```bash
npm run db:seed
```

Demo login:

```text
Email: student.demo@studyguard.local
Password: StudyGuardDemo123!
```

Seed coverage:

- courses, including active and archived courses
- coursework across open, in-progress, completed, missed, postponed, and no-due-date states
- weekly availability and availability exceptions
- an active generated study plan with stored study blocks
- pending, edited, approved, and rejected recommendations
- study sessions, check-ins, and grade records for progress/dashboard testing

## Manual QA Issues Found

### 1. Frontend Could Not Reach API From 127.0.0.1

Reported error:

```text
Cannot reach StudyGuard API at http://127.0.0.1:4000.
```

Cause:

- frontend was opened at `http://127.0.0.1:5173/`
- backend CORS config only allowed `http://localhost:5173`
- browser blocked the API response, which surfaced as a fetch connection error

Fix applied:

- updated `server/src/app.js` to support multiple allowed frontend origins
- updated `server/.env.example` and local `server/.env` to include both `localhost:5173` and `127.0.0.1:5173`
- restarted the backend from the current code

Verification:

- `Origin: http://localhost:5173` receives `Access-Control-Allow-Origin: http://localhost:5173`
- `Origin: http://127.0.0.1:5173` receives `Access-Control-Allow-Origin: http://127.0.0.1:5173`
- backend tests pass
- client build passes
- full format check passes
- user confirmed the browser can reach the API on August 20, 2026

Status: fixed and user-verified.

## Final Sign-Off

Manual browser QA completed by:

```text
Name:
Date:
```

Final MVP status:

```text
[ ] Signed off
[ ] Signed off with documented limitations
[ ] Not signed off; defects require fixes
```

Defects requiring follow-up:

```text

```

Known limitations accepted for MVP:

```text

```

## Next Step After Sign-Off

After manual sign-off, update this document and README with the final status.

The next technical stage can then be either:

- deployment planning, or
- frontend browser automation setup.
