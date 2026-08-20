# Stage 12A: Study Plan API Design

## Goal

The goal of Stage 12A is to design the Study Plan API before we implement it.

This is the first scheduling stage. StudyGuard already has the core inputs it needs:

- student account and planning priority
- courses
- coursework with due dates, priority, difficulty, and effort estimates
- reusable weekly availability
- one-time availability exceptions

This stage does not add route code yet. The implementation comes in Stage 12B.

## Why Study Plans Come Next

Coursework answers the question:

```text
What work needs to be done?
```

Availability answers the question:

```text
When can the student study?
```

A study plan combines both answers into calendar blocks.

The API should return scheduled study blocks, unscheduled work, workload warnings, and explanations so the student can understand the plan instead of seeing a mysterious auto-generated calendar.

## Existing Database Tables

The study plan tables already exist from Stage 6.

### `study_plans`

Columns:

- `id`
- `user_id`
- `plan_start_date`
- `plan_end_date`
- `status`
- `planning_priority`
- `overload_status`
- `generated_at`
- `approved_at`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `plan_start_date` is required
- `plan_end_date` is required
- `plan_start_date` must be before or equal to `plan_end_date`
- `status` must be `draft`, `active`, or `archived`
- `planning_priority` must use one of the allowed user planning priority values
- `overload_status` must be `unknown`, `balanced`, `heavy`, or `overloaded`
- `generated_at` defaults to now
- `approved_at` is null until the student approves the plan
- `updated_at` is handled by a database trigger

### `study_blocks`

Columns:

- `id`
- `user_id`
- `study_plan_id`
- `coursework_id`
- `block_type`
- `start_at`
- `end_at`
- `status`
- `explanation`
- `created_at`
- `updated_at`

Important database rules:

- `user_id` is required
- `study_plan_id` is required
- `coursework_id` is optional
- `block_type` must be `study`, `break`, or `buffer`
- `start_at` is required
- `end_at` is required
- `start_at` must be before `end_at`
- `status` must be `planned`, `completed`, `missed`, `moved`, or `cancelled`
- deleting a study plan deletes its blocks
- deleting coursework keeps the block but clears `coursework_id`

## Ownership Rules

The frontend must never send `user_id`.

The backend gets ownership from the verified token:

```text
Authorization: Bearer <token>
-> requireAuth verifies token
-> req.user.id becomes the owner ID
-> study plan service uses req.user.id in SQL
```

Every query for plans, blocks, coursework, availability, and exceptions must include the signed-in student ID.

A student should never be able to see, approve, archive, or delete another student's plan.

Use `404` instead of `403` when a plan ID exists but does not belong to the signed-in user.

## Planned Endpoint Path

Use `/api/study-plans` for this feature area.

This path represents generated plans. The scheduling service may read coursework and availability internally, but those resources keep their existing endpoints.

## Planned Endpoints

### 1. Generate A Draft Study Plan

```http
POST /api/study-plans/generate
```

Authentication required: yes.

Request body:

```json
{
  "startDate": "2026-08-19",
  "endDate": "2026-08-25",
  "planningPriority": "balance_deadlines_wellbeing"
}
```

Field behavior:

- `startDate` is optional
- `endDate` is optional
- if `startDate` is omitted, use today's date
- if `endDate` is omitted, use six days after `startDate`
- if `planningPriority` is omitted, use the student's saved `users.planning_priority`

Validation rules:

- dates must use `YYYY-MM-DD`
- `startDate` must be on or before `endDate`
- the requested range can be at most 31 days for the MVP
- `planningPriority` must be one of the allowed values if provided

Allowed `planningPriority` values:

- `meet_deadlines`
- `prevent_burnout`
- `balance_deadlines_wellbeing`
- `custom`

MVP behavior for `custom`:

- accept the value
- store it on the plan
- schedule it like `balance_deadlines_wellbeing` until a later profile/preferences stage defines custom rules
- include a warning explaining that custom planning is not configured yet

Success status:

```text
201 Created
```

Success response:

```json
{
  "success": true,
  "data": {
    "studyPlan": {
      "id": "study-plan-id",
      "planStartDate": "2026-08-19",
      "planEndDate": "2026-08-25",
      "status": "draft",
      "planningPriority": "balance_deadlines_wellbeing",
      "overloadStatus": "heavy",
      "generatedAt": "timestamp",
      "approvedAt": null,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "studyBlocks": [
      {
        "id": "study-block-id",
        "studyPlanId": "study-plan-id",
        "courseworkId": "coursework-id",
        "coursework": {
          "id": "coursework-id",
          "title": "Biology lab report",
          "type": "assignment",
          "dueAt": "2026-08-22T02:00:00.000Z",
          "priority": "high",
          "difficulty": "hard",
          "estimatedMinutes": 180,
          "course": {
            "id": "course-id",
            "name": "Biology I",
            "code": "BIO 101",
            "color": "#10B981"
          }
        },
        "blockType": "study",
        "startAt": "2026-08-19T22:00:00.000Z",
        "endAt": "2026-08-19T23:30:00.000Z",
        "status": "planned",
        "explanation": "Scheduled early because this item is due soon and has high priority.",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    ],
    "summary": {
      "availableMinutes": 900,
      "requiredMinutes": 1080,
      "scheduledMinutes": 900,
      "unscheduledMinutes": 180,
      "studyBlockCount": 8,
      "studyDayCount": 5,
      "overloadStatus": "heavy"
    },
    "unscheduledCoursework": [
      {
        "id": "coursework-id",
        "title": "History reading",
        "remainingMinutes": 180,
        "reason": "Not enough availability before the due date."
      }
    ],
    "warnings": [
      {
        "code": "insufficient_availability",
        "message": "Required effort is 18 hours, but available study time is 15 hours."
      }
    ],
    "explanations": [
      "Urgent and high-priority coursework was scheduled first.",
      "Study blocks were only placed inside available study windows."
    ]
  }
}
```

Generation side effects:

- create one `study_plans` row with `status = draft`
- create `study_blocks` rows for scheduled blocks
- archive older draft plans owned by the same user for the same exact date range
- do not delete or change coursework
- do not create recommendations yet
- do not mark any study block complete

### 2. List Study Plans

```http
GET /api/study-plans
```

Authentication required: yes.

Default behavior: return draft and active plans owned by the signed-in student, sorted by `generated_at` descending.

Optional query strings:

```http
GET /api/study-plans?status=active
GET /api/study-plans?status=draft
GET /api/study-plans?status=archived
GET /api/study-plans?status=all
GET /api/study-plans?from=2026-08-19&to=2026-08-25
```

Allowed `status` filter values:

- `current`
- `all`
- `draft`
- `active`
- `archived`

`current` means draft or active.

Date filter rules:

- `from` must be a `YYYY-MM-DD` date if provided
- `to` must be a `YYYY-MM-DD` date if provided
- if both are provided, `from` must be on or before `to`
- date filters should return plans whose ranges overlap the requested filter range

Success response:

```json
{
  "success": true,
  "data": {
    "studyPlans": [
      {
        "id": "study-plan-id",
        "planStartDate": "2026-08-19",
        "planEndDate": "2026-08-25",
        "status": "draft",
        "planningPriority": "balance_deadlines_wellbeing",
        "overloadStatus": "heavy",
        "generatedAt": "timestamp",
        "approvedAt": null,
        "createdAt": "timestamp",
        "updatedAt": "timestamp",
        "summary": {
          "studyBlockCount": 8,
          "scheduledMinutes": 900
        }
      }
    ]
  }
}
```

Planned SQL shape:

```sql
SELECT study plan columns, aggregate block counts and scheduled minutes
FROM study_plans
LEFT JOIN study_blocks
  ON study_blocks.study_plan_id = study_plans.id
  AND study_blocks.user_id = study_plans.user_id
WHERE study_plans.user_id = $1
GROUP BY study_plans.id
ORDER BY study_plans.generated_at DESC;
```

### 3. Get One Study Plan

```http
GET /api/study-plans/:studyPlanId
```

Authentication required: yes.

The study plan ID must be a UUID.

The lookup must include both `id` and `user_id`:

```sql
SELECT study plan columns
FROM study_plans
WHERE id = $1 AND user_id = $2;
```

Blocks must also be owner-scoped:

```sql
SELECT study block columns, coursework summary columns, course summary columns
FROM study_blocks
LEFT JOIN coursework
  ON coursework.id = study_blocks.coursework_id
  AND coursework.user_id = study_blocks.user_id
LEFT JOIN courses
  ON courses.id = coursework.course_id
  AND courses.user_id = coursework.user_id
WHERE study_blocks.study_plan_id = $1
  AND study_blocks.user_id = $2
ORDER BY study_blocks.start_at ASC;
```

If no owned plan row is found, return `404`.

Success response uses the same detailed shape as generate, but without creating anything new.

### 4. Approve A Draft Study Plan

```http
POST /api/study-plans/:studyPlanId/approve
```

Authentication required: yes.

The study plan ID must be a UUID.

Business rules:

- only an owned `draft` plan can be approved
- approving a draft changes its status to `active`
- approving sets `approved_at` to `now()`
- approving archives overlapping active plans for the same user
- approving does not mark any block complete

Overlap rule for existing active plans:

```sql
plan_start_date <= new_plan_end_date
AND plan_end_date >= new_plan_start_date
```

Success response:

```json
{
  "success": true,
  "data": {
    "studyPlan": {
      "id": "study-plan-id",
      "status": "active",
      "approvedAt": "timestamp"
    }
  }
}
```

Error behavior:

- return `404` if the plan does not exist or is not owned by the user
- return `409 Conflict` if the plan is already archived
- return `409 Conflict` if the plan is already active

### 5. Archive A Study Plan

```http
POST /api/study-plans/:studyPlanId/archive
```

Authentication required: yes.

Business rules:

- owned draft and active plans can be archived
- archived plans stay readable through list/get when requested
- archiving does not delete study blocks
- archiving does not change coursework

Success response:

```json
{
  "success": true,
  "data": {
    "studyPlan": {
      "id": "study-plan-id",
      "status": "archived"
    }
  }
}
```

Error behavior:

- return `404` if the plan does not exist or is not owned by the user
- return `409 Conflict` if the plan is already archived

## Scheduling Inputs

The generator should load these inputs for the signed-in student:

### Student

Needed fields:

- `id`
- `planning_priority`

### Coursework

Include coursework where:

- `user_id = req.user.id`
- `status IN ('not_started', 'in_progress', 'postponed')`
- `estimated_minutes > 0`
- `due_at IS NULL` or `due_at` is after the plan start

Exclude coursework where:

- `status = completed`
- `status = missed`
- `status = archived`

Planning behavior:

- coursework with due dates should be prioritized before no-due-date work
- coursework should not be scheduled after its due date
- no-due-date work can fill remaining available time after due-dated work

### Weekly Availability

Load all weekly windows owned by the user.

For each date in the plan range:

- find that date's weekday
- copy matching weekly windows onto that calendar date
- convert local wall-clock windows into `start_at` and `end_at` timestamps for study blocks

### Availability Exceptions

Load exceptions where:

```sql
exception_date BETWEEN $startDate AND $endDate
```

Apply exceptions after weekly windows are expanded:

- full-day `unavailable` removes all slots for that date
- partial-day `unavailable` subtracts that time range from any overlapping slots
- partial-day `extra_available` adds a new slot for that date
- full-day `extra_available` adds the MVP default planning-day slot of `09:00` to `21:00`

After applying exceptions, merge overlapping or adjacent available slots.

## MVP Timezone Decision

Weekly availability and availability exceptions are local wall-clock inputs.

The MVP does not have a profile timezone field yet. For Stage 12B, the backend should combine dates and times using the backend process timezone.

Local development currently runs in the machine's local timezone. A later Profile stage can add a saved timezone and regenerate future plans from that preference.

The API should still return `study_blocks.startAt` and `study_blocks.endAt` as ISO timestamps because `study_blocks.start_at` and `study_blocks.end_at` are `TIMESTAMPTZ` columns.

## Scheduling Rules For Stage 12B

The first scheduling algorithm should be deterministic and testable.

Use these simple MVP rules:

- generate blocks in 30-minute increments when possible
- do not create a study block shorter than 25 minutes
- prefer study blocks between 45 and 90 minutes
- never create a block outside an available slot
- never schedule coursework after its due date
- schedule urgent and high-priority work before medium and low priority work
- schedule closer due dates before later due dates
- use difficulty and grade weight as tie-breakers
- place no-due-date work only after due-dated work has been considered
- keep explanations short and specific

Planning priority should influence sorting and daily load:

- `meet_deadlines`: strongest due-date and priority weighting
- `prevent_burnout`: limit scheduled minutes per day more aggressively and add warnings before filling every slot
- `balance_deadlines_wellbeing`: default mixed weighting
- `custom`: behaves like `balance_deadlines_wellbeing` until custom preferences exist

## Overload Status

Compute overload status from required effort and available time.

Suggested MVP thresholds:

- `balanced`: scheduled all required work and used less than 80% of available time
- `heavy`: scheduled all required work but used 80% or more of available time, or left less than 20% unscheduled
- `overloaded`: could not schedule 20% or more of required work
- `unknown`: use only when the generator cannot compute a meaningful summary

Store the computed value in `study_plans.overload_status`.

Return the same value in `summary.overloadStatus`.

## Warning Codes

Use structured warning codes so the frontend can render them consistently.

Suggested initial codes:

- `no_availability`
- `insufficient_availability`
- `due_before_available_time`
- `partial_schedule`
- `custom_priority_not_configured`

Warning messages should be human-readable and specific.

## Response Shape

All successful JSON responses should follow:

```json
{
  "success": true,
  "data": {}
}
```

Study plan list responses should use `studyPlans`.

Detailed plan responses should use:

- `studyPlan`
- `studyBlocks`
- `summary`
- `unscheduledCoursework`
- `warnings`
- `explanations`

Errors should follow:

```json
{
  "success": false,
  "error": {
    "message": "Something went wrong."
  }
}
```

## Error Decisions

### Missing Token

Status: `401 Unauthorized`

Message:

```text
Authentication required.
```

### Invalid Token

Status: `401 Unauthorized`

Message:

```text
Invalid or expired token.
```

### Invalid Body, Params, Or Query

Status: `400 Bad Request`

Message:

```text
Validation failed.
```

### Study Plan Not Found Or Not Owned By User

Status: `404 Not Found`

Message:

```text
Study plan not found.
```

### Invalid Study Plan State Change

Status: `409 Conflict`

Messages:

```text
Only draft study plans can be approved.
Study plan is already archived.
```

## What We Are Not Building Yet

These are real features, but they should wait until the first study-plan generation route works:

- dragging or manually moving study blocks
- completing study blocks
- logging actual study sessions
- recommendation approval workflow
- adaptive effort estimates
- profile timezone preference
- custom planning preference editor
- calendar integrations

## Files We Will Add In Stage 12B

Planned backend files:

- `server/src/validators/studyPlanValidators.js`
- `server/src/services/schedulingService.js`
- `server/src/services/studyPlanService.js`
- `server/src/controllers/studyPlanController.js`
- `server/src/routes/studyPlanRoutes.js`
- `server/tests/studyPlanRoutes.test.js`

Planned existing files to update:

- `server/src/app.js` to mount `/api/study-plans`
- `server/src/utils/httpErrors.js` only if another error helper becomes useful

## Planned Route Wiring

The route layer should look conceptually like this:

```text
router.get("/", requireAuth, validateRequest(listStudyPlansSchema), asyncHandler(listStudyPlans));
router.post("/generate", requireAuth, validateRequest(generateStudyPlanSchema), asyncHandler(generateStudyPlan));
router.get("/:studyPlanId", requireAuth, validateRequest(studyPlanIdSchema), asyncHandler(getStudyPlan));
router.post("/:studyPlanId/approve", requireAuth, validateRequest(studyPlanIdSchema), asyncHandler(approveStudyPlan));
router.post("/:studyPlanId/archive", requireAuth, validateRequest(studyPlanIdSchema), asyncHandler(archiveStudyPlan));
```

## Planned Tests For Stage 12B

The implementation tests should prove:

- missing tokens return `401`
- invalid date ranges return `400`
- the default generation range covers seven calendar days
- generation creates a draft study plan
- generation creates only owner-scoped blocks
- generation uses the student's saved planning priority by default
- a provided planning priority is stored on the generated plan
- open coursework can be scheduled into available windows
- completed, missed, and archived coursework are excluded
- blocks are not scheduled outside availability
- blocks are not scheduled after a coursework due date
- full-day unavailable exceptions remove that day's slots
- partial unavailable exceptions subtract time from matching slots
- extra-available exceptions add usable slots
- overloaded plans return warning data
- plans with no availability return a clear warning and no blocks
- listing plans only returns the signed-in student's plans
- getting another student's plan returns `404`
- approving a draft plan sets `status = active` and `approvedAt`
- approving archives overlapping active plans for the same user
- archiving a plan sets `status = archived`
- invalid state changes return `409`
- existing auth, health, course, coursework, and availability tests still pass

## Request Flow Preview

Generating a plan will follow this backend path:

```text
Client
-> POST /api/study-plans/generate
-> requireAuth verifies JWT
-> validateRequest checks body
-> studyPlanController.generateStudyPlan
-> studyPlanService.generateStudyPlanForUser
-> service loads student planning priority
-> service loads owned coursework, weekly availability, and exceptions
-> schedulingService builds availability slots and study blocks
-> service inserts the draft study plan and study blocks in a transaction
-> controller returns 201 JSON
-> Client displays the draft plan
```

## Stage 12A Acceptance Criteria

Stage 12A is complete when:

- The Study Plan API path is chosen
- Generate, list, get, approve, and archive endpoints are documented
- Request bodies are documented
- Query filters are documented
- Validation rules are documented
- Ownership rules are documented
- Scheduling inputs are documented
- Timezone assumptions are documented
- Overload status rules are documented
- Warning codes are documented
- Stage 12B implementation files are identified
- You approve moving to Stage 12B

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

Before Stage 12B, make sure you can answer these:

1. Why should generating a study plan create a draft instead of immediately activating it?
2. Why does the scheduler need both weekly availability and one-time exceptions?
3. Why should the first scheduling algorithm be deterministic before it becomes more personalized?
4. Why do study blocks store timestamps even though availability uses local times?
