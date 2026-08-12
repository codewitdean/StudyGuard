# Stage 6: Database Schema and Migrations

## Goal

The goal of Stage 6 is to turn the StudyGuard data model into versioned SQL migrations.

By the end of this stage, we should understand:

- Which tables the MVP needs
- Why each table exists
- How tables relate to each other
- Which columns each table stores
- Which constraints protect the data
- Which indexes support common queries
- How migrations let us recreate the database structure

This stage creates database structure only. It does not create auth, course, or coursework API routes yet.

## What Changed

New files:

- `server/src/database/migrations/001_create_core_schema.sql`
- `server/src/database/migrate.js`
- `docs/stage-06-database-schema-and-migrations.md`

Changed files:

- `package.json`
- `server/package.json`
- `server/.env.example`
- `README.md`
- `docs/stage-05-postgresql-database-fundamentals.md`

New backend dependency:

- `pg`: the official PostgreSQL client for Node.js

## Current Database Tooling State

PostgreSQL command-line tools are now available:

```text
psql (PostgreSQL) 16.14 (Homebrew)
createdb (PostgreSQL) 16.14 (Homebrew)
```

Homebrew shows PostgreSQL is installed:

```text
postgresql@16
```

At the start of Stage 6, the PostgreSQL service was installed but not running:

```text
/tmp:5432 - no response
```

## Migration Files

A migration is a versioned file that changes the database structure.

Our first migration is:

```text
server/src/database/migrations/001_create_core_schema.sql
```

The `001` prefix matters. It keeps migrations in order.

## Migration Runner

The migration runner is:

```text
server/src/database/migrate.js
```

Its job:

1. Read `DATABASE_URL`.
2. Connect to PostgreSQL.
3. Create a `schema_migrations` table if it does not exist.
4. Read `.sql` files from the migrations folder.
5. Skip migrations already listed in `schema_migrations`.
6. Run new migrations inside a transaction.
7. Record each applied migration.

The runner lets us use:

```bash
npm run db:migrate
```

## Why We Use `schema_migrations`

The `schema_migrations` table remembers which migration files already ran.

Without it, every migration would run again every time, causing errors like:

```text
relation "users" already exists
```

## Why Migrations Run in a Transaction

A transaction means:

```text
Either the whole migration succeeds, or none of it is saved.
```

That protects the database from being left halfway changed if one SQL statement fails.

## Initial MVP Tables

The initial schema includes these tables:

- `users`
- `courses`
- `coursework`
- `coursework_dependencies`
- `weekly_availability`
- `availability_exceptions`
- `study_plans`
- `study_blocks`
- `recommendations`
- `study_sessions`
- `check_ins`
- `grades`

These are enough for the MVP direction:

- Authentication
- Course management
- Coursework and deadlines
- Availability
- Scheduling
- Recommendation approval
- Progress tracking
- Grades
- Wellbeing check-ins

Postponed tables:

- Uploaded syllabi
- AI extraction reviews
- AI prompt/response audit logs
- Email reminder history
- Calendar integration tokens

Those should wait until the related feature stages.

## Shared Schema Choices

### UUID Primary Keys

Most tables use:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

This gives each row a unique ID.

The migration enables:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

That gives PostgreSQL the `gen_random_uuid()` function.

### Timestamps

Most tables include:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

`created_at` tells us when a row was created.

`updated_at` tells us when a row last changed.

The migration adds triggers that automatically refresh `updated_at` before updates.

### Ownership

Most tables include:

```sql
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

This matters because StudyGuard is private per student.

Every future query for private data should include ownership logic like:

```sql
WHERE id = $1
AND user_id = $2
```

That prevents one user from accessing another user's data.

### Text Checks Instead of PostgreSQL Enums

For values such as priority, status, and type, this schema uses `TEXT` columns with `CHECK` constraints.

Example:

```sql
priority TEXT NOT NULL CHECK (
  priority IN ('low', 'medium', 'high', 'urgent')
)
```

This is easier to change while learning than PostgreSQL enum types.

## Table-by-Table Design

## `users`

### Why It Exists

Stores private student accounts.

### Columns

- `id`: primary key for the user
- `name`: student's display name
- `email`: login email, stored lowercase and unique
- `password_hash`: hashed password, never the plain password
- `planning_priority`: selected scheduling preference
- `created_at`: when the user was created
- `updated_at`: when the user was last updated

### Primary Key

- `id`

### Foreign Keys

- None

### Constraints

- `email` must be unique
- `email` must already be lowercase
- `name` cannot be blank
- `password_hash` cannot be blank
- `planning_priority` must be one of the allowed values

### Cascade Behavior

Other tables point to `users(id)` with `ON DELETE CASCADE`.

If a student deletes their account, their related StudyGuard data should be deleted too.

## `courses`

### Why It Exists

Stores the student's courses so coursework can be organized by class.

### Columns

- `id`: primary key for the course
- `user_id`: owner of the course
- `name`: course name, such as `Biology I`
- `code`: optional course code, such as `BIO 101`
- `instructor`: optional instructor name
- `color`: optional hex color for UI organization
- `term`: optional term, such as `Spring 2027`
- `target_grade`: optional student goal
- `is_archived`: hides old courses without deleting history
- `created_at`: when the course was created
- `updated_at`: when the course was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`

### Constraints

- Course name cannot be blank
- Color must look like a hex color if provided
- `user_id` is required

### Indexes

- `courses_user_archived_idx` helps list active or archived courses for one user

### Cascade Behavior

If the user is deleted, the user's courses are deleted.

Coursework uses `ON DELETE SET NULL` for `course_id`, so deleting a course does not automatically erase coursework history.

## `coursework`

### Why It Exists

Stores assignments, projects, quizzes, tests, exams, readings, and study tasks.

### Columns

- `id`: primary key for the coursework item
- `user_id`: owner of the item
- `course_id`: optional related course
- `title`: item title
- `description`: optional longer description
- `type`: assignment, project, quiz, test, exam, reading, or study task
- `due_at`: optional due date and time
- `priority`: low, medium, high, or urgent
- `difficulty`: easy, medium, hard, or very hard
- `estimated_minutes`: estimated time required
- `status`: current workflow state
- `grade_weight`: optional course grade weight from 0 to 100
- `topic`: optional topic or unit
- `notes`: optional private notes
- `completed_at`: when the item was completed
- `created_at`: when the item was created
- `updated_at`: when the item was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`
- `course_id -> courses.id`

### Constraints

- Title cannot be blank
- Type must be an allowed coursework type
- Estimated minutes must be greater than 0
- Priority, difficulty, and status must be allowed values
- Grade weight must be between 0 and 100 if provided

### Indexes

- `coursework_user_status_due_idx` helps find open work sorted by due date
- `coursework_user_course_idx` helps list work for one course
- `coursework_user_due_idx` helps find upcoming deadlines

### Cascade Behavior

If the user is deleted, the coursework is deleted.

If the related course is deleted, `course_id` becomes `NULL`.

## `coursework_dependencies`

### Why It Exists

Stores relationships where one coursework item must happen before another.

Example:

```text
"Read chapter 4" must happen before "Complete chapter 4 quiz"
```

### Columns

- `coursework_id`: the item that has a dependency
- `depends_on_coursework_id`: the item that must be done first
- `created_at`: when the dependency was created

### Primary Key

- `(coursework_id, depends_on_coursework_id)`

### Foreign Keys

- `coursework_id -> coursework.id`
- `depends_on_coursework_id -> coursework.id`

### Constraints

- An item cannot depend on itself

### Cascade Behavior

If either coursework item is deleted, the dependency row is deleted.

## `weekly_availability`

### Why It Exists

Stores reusable study windows for a normal week.

### Columns

- `id`: primary key for the availability window
- `user_id`: owner of the window
- `weekday`: day of week, where `1` is Monday and `7` is Sunday
- `start_time`: local start time
- `end_time`: local end time
- `label`: optional label, such as `Library time`
- `created_at`: when the window was created
- `updated_at`: when the window was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`

### Constraints

- Weekday must be between 1 and 7
- Start time must be before end time
- The exact same window cannot be duplicated for the same user

### Indexes

- `weekly_availability_user_weekday_idx` helps load a user's template by weekday

### Cascade Behavior

If the user is deleted, their availability windows are deleted.

## `availability_exceptions`

### Why It Exists

Stores one-time changes to the weekly availability template.

Examples:

- Unavailable because of work
- Extra free time on a holiday
- Full unavailable day while traveling

### Columns

- `id`: primary key for the exception
- `user_id`: owner of the exception
- `exception_date`: date affected by the exception
- `type`: unavailable or extra available
- `is_full_day`: whether the exception affects the whole day
- `start_time`: local start time for partial-day exceptions
- `end_time`: local end time for partial-day exceptions
- `reason`: optional reason
- `created_at`: when the exception was created
- `updated_at`: when the exception was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`

### Constraints

- Type must be `unavailable` or `extra_available`
- Full-day exceptions must not have start or end times
- Partial-day exceptions must have start and end times
- Start time must be before end time

### Indexes

- `availability_exceptions_user_date_idx` helps load exceptions for a date range

### Cascade Behavior

If the user is deleted, their exceptions are deleted.

## `study_plans`

### Why It Exists

Stores a generated plan for a date range.

The scheduling engine will create these later.

### Columns

- `id`: primary key for the plan
- `user_id`: owner of the plan
- `plan_start_date`: first date included
- `plan_end_date`: last date included
- `status`: draft, active, or archived
- `planning_priority`: priority used when the plan was generated
- `overload_status`: unknown, balanced, heavy, or overloaded
- `generated_at`: when the plan was generated
- `approved_at`: when the student approved it, if approval is needed
- `created_at`: when the row was created
- `updated_at`: when the row was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`

### Constraints

- Start date must be before or equal to end date
- Status must be an allowed value
- Planning priority must be an allowed value
- Overload status must be an allowed value

### Indexes

- `study_plans_user_status_idx` helps find a user's active or draft plan

### Cascade Behavior

If the user is deleted, their study plans are deleted.

Study blocks are deleted when their parent study plan is deleted.

## `study_blocks`

### Why It Exists

Stores individual scheduled blocks inside a study plan.

Examples:

- Study block
- Break
- Buffer time before an exam

### Columns

- `id`: primary key for the block
- `user_id`: owner of the block
- `study_plan_id`: parent study plan
- `coursework_id`: optional coursework item this block supports
- `block_type`: study, break, or buffer
- `start_at`: start date and time
- `end_at`: end date and time
- `status`: planned, completed, missed, moved, or cancelled
- `explanation`: optional reason the block exists
- `created_at`: when the block was created
- `updated_at`: when the block was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`
- `study_plan_id -> study_plans.id`
- `coursework_id -> coursework.id`

### Constraints

- Start time must be before end time
- Block type must be allowed
- Status must be allowed

### Indexes

- `study_blocks_user_start_idx` helps load a user's calendar blocks
- `study_blocks_plan_start_idx` helps load blocks inside one plan in order

### Cascade Behavior

If the user or study plan is deleted, study blocks are deleted.

If the coursework item is deleted, `coursework_id` becomes `NULL`.

## `recommendations`

### Why It Exists

Stores schedule and workload suggestions that the student must review before applying.

StudyGuard must not silently change a student's schedule.

### Columns

- `id`: primary key for the recommendation
- `user_id`: owner of the recommendation
- `coursework_id`: optional related coursework item
- `study_block_id`: optional related study block
- `type`: kind of recommendation
- `status`: pending, approved, rejected, or edited
- `title`: short recommendation title
- `reason`: explanation for why it was suggested
- `proposed_change`: structured JSON describing the suggested change
- `edited_change`: optional structured JSON after the student edits it
- `decided_at`: when the student approved, rejected, or edited it
- `created_at`: when the recommendation was created
- `updated_at`: when the recommendation was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`
- `coursework_id -> coursework.id`
- `study_block_id -> study_blocks.id`

### Constraints

- Type must be one of the known recommendation types
- Status must be one of the known statuses
- Title and reason cannot be blank
- `proposed_change` must always be valid JSONB

### Indexes

- `recommendations_user_status_idx` helps load pending recommendations

### Cascade Behavior

If the user is deleted, recommendations are deleted.

If related coursework or a block is deleted, the recommendation remains but the reference becomes `NULL`.

## `study_sessions`

### Why It Exists

Stores actual time spent studying.

This supports progress tracking and future adaptive effort estimates.

### Columns

- `id`: primary key for the study session
- `user_id`: owner of the session
- `coursework_id`: optional related coursework item
- `study_block_id`: optional related scheduled block
- `source`: manual or timer
- `started_at`: optional start timestamp
- `ended_at`: optional end timestamp
- `duration_minutes`: actual study duration
- `notes`: optional notes
- `created_at`: when the session was created
- `updated_at`: when the session was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`
- `coursework_id -> coursework.id`
- `study_block_id -> study_blocks.id`

### Constraints

- Duration must be greater than 0
- Source must be manual or timer
- If both start and end timestamps exist, start must be before end

### Indexes

- `study_sessions_user_created_idx` helps show recent study sessions
- `study_sessions_coursework_idx` helps total time spent on one coursework item

### Cascade Behavior

If the user is deleted, study sessions are deleted.

If related coursework or a study block is deleted, the session remains but the reference becomes `NULL`.

## `check_ins`

### Why It Exists

Stores optional energy, stress, and focus check-ins.

This feature is supportive and non-medical.

### Columns

- `id`: primary key for the check-in
- `user_id`: owner of the check-in
- `check_in_date`: date of the check-in
- `energy_level`: optional 1 to 5 rating
- `stress_level`: optional 1 to 5 rating
- `focus_level`: optional 1 to 5 rating
- `note`: optional personal note
- `created_at`: when the check-in was created
- `updated_at`: when the check-in was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`

### Constraints

- Energy, stress, and focus must be from 1 to 5 if provided
- One check-in per user per date

### Indexes

- `check_ins_user_date_idx` helps load check-ins by date

### Cascade Behavior

If the user is deleted, their check-ins are deleted.

## `grades`

### Why It Exists

Stores academic performance entries.

Performance is used as one planning signal, not as a judgment of ability.

### Columns

- `id`: primary key for the grade
- `user_id`: owner of the grade
- `course_id`: optional related course
- `coursework_id`: optional related coursework item
- `assessment_type`: assignment, project, quiz, test, or exam
- `score`: points earned
- `max_score`: maximum possible points
- `grade_weight`: optional course grade weight from 0 to 100
- `topic`: optional topic or unit
- `is_unusual`: marks results that should not strongly influence patterns
- `notes`: optional notes
- `graded_at`: date the grade was received
- `created_at`: when the grade was created
- `updated_at`: when the grade was last updated

### Primary Key

- `id`

### Foreign Keys

- `user_id -> users.id`
- `course_id -> courses.id`
- `coursework_id -> coursework.id`

### Constraints

- Assessment type must be allowed
- Score cannot be negative
- Max score must be greater than 0
- Grade weight must be between 0 and 100 if provided

### Indexes

- `grades_user_course_idx` helps analyze grades by course
- `grades_user_coursework_idx` helps connect a grade to one coursework item

### Cascade Behavior

If the user is deleted, grades are deleted.

If related coursework or a course is deleted, the grade remains but the reference becomes `NULL`.

## Why Some Foreign Keys Use `ON DELETE SET NULL`

Some records are historical.

Example:

```text
A study session should still count toward progress even if a coursework item is deleted later.
```

For this reason, some relationships use:

```sql
ON DELETE SET NULL
```

That keeps the history while removing the broken reference.

## Why Some Foreign Keys Use `ON DELETE CASCADE`

Private user data should be removed when the user deletes their account.

For this reason, most tables use:

```sql
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

If the user goes away, their private data goes with them.

## Important Security Notes

### Passwords

The database stores:

```text
password_hash
```

It must never store:

```text
password
plain_text_password
```

Hashing will be implemented during the authentication stage.

### SQL Injection

The migration runner executes trusted SQL files from our repo.

Application features must use parameterized queries later:

```sql
SELECT *
FROM courses
WHERE id = $1
AND user_id = $2;
```

### Ownership

Foreign keys prove that a row belongs to some user.

They do not replace authorization checks in the backend.

The backend must still check:

```text
Is this authenticated user allowed to access this row?
```

## Commands

Start PostgreSQL with Homebrew:

```bash
brew services start postgresql@16
```

Create the development database:

```bash
createdb studyguard_dev
```

Set up the backend environment file:

```bash
cp server/.env.example server/.env
```

Run migrations:

```bash
npm run db:migrate
```

For the Stage 6 verification run, the migration was executed with an inline local database URL:

```bash
DATABASE_URL=postgresql://localhost:5432/studyguard_dev npm run db:migrate
```

Result:

```text
Applied migration: 001_create_core_schema.sql
Database migrations complete.
```

Rerunning the same command safely skipped the already-applied migration:

```text
Skipped migration: 001_create_core_schema.sql
Database migrations complete.
```

Inspect tables:

```bash
psql studyguard_dev
```

Inside `psql`:

```sql
\dt
\d users
\d courses
SELECT name, applied_at FROM schema_migrations;
```

Exit `psql`:

```sql
\q
```

## Request Flow Preview With Database

Later, creating a course will look like this:

```text
Client -> Route -> Auth Middleware -> Controller -> Validator -> Service -> Database
Database -> Service -> Controller -> Response -> Client
```

The SQL will look similar to:

```sql
INSERT INTO courses (user_id, name, code, term, color)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, code, term, color, is_archived, created_at, updated_at;
```

The values will be passed separately:

```js
[userId, name, code, term, color];
```

## Stage 6 Acceptance Criteria

Stage 6 is complete when:

- The MVP schema is documented.
- Every table has a clear purpose.
- Primary keys and foreign keys are explained.
- Cascade behavior is intentional.
- The initial SQL migration exists.
- The migration runner exists.
- `DATABASE_URL` is documented in `.env.example`.
- Existing backend tests still pass.
- You approve the next stage.

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - complete
- Stage 4: Backend request-and-response fundamentals - complete
- Stage 5: PostgreSQL and database fundamentals - complete
- Stage 6: Database schema and migrations - in progress
- Stage 7: Basic Express server and health endpoint - covered by Stage 4
- Stage 8: Registration, login, and protected routes - not started

## Understanding Check

Before the next stage, make sure you can answer these:

1. Why does most private data include `user_id`?
2. Why do migrations need to run in order?
3. Why do we record applied migrations in `schema_migrations`?
4. Why does deleting a user cascade, but deleting a course does not erase every historical record?
