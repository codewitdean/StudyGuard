# Stage 5: PostgreSQL and Database Fundamentals

## Goal

The goal of Stage 5 is to understand how StudyGuard will store data before we design the actual schema.

This stage connects the backend to persistent storage:

- The Express backend receives HTTP requests.
- The backend validates and authorizes those requests.
- The backend uses SQL to read or write PostgreSQL data.
- PostgreSQL keeps the data after the server stops.

We are not creating tables yet. That belongs to Stage 6.

## Local Tool Check

These commands were checked on this machine:

```bash
psql --version
createdb --version
pg_isready
```

Current result:

```text
psql: command not found
createdb: command not found
pg_isready: command not found
```

At the first Stage 5 check, that meant PostgreSQL command-line tools were not installed or were not on the shell `PATH`.

Homebrew is available:

```text
Homebrew 6.0.11
```

Stage 6 rechecked this and found PostgreSQL tools available through Homebrew. The local PostgreSQL service still needed to be started before migrations could run.

## Why StudyGuard Needs a Database

StudyGuard needs to remember private student data:

- User accounts
- Courses
- Coursework
- Deadlines
- Availability
- Study plans
- Study blocks
- Recommendations
- Study sessions
- Check-ins
- Grades

Without a database, this information would disappear when the server restarts.

## What PostgreSQL Is

PostgreSQL is a relational database.

Relational means data is organized into tables, and tables can connect to each other.

For StudyGuard, examples include:

- A user can have many courses.
- A course can have many coursework items.
- A coursework item can have many study sessions.
- A user can have many availability windows.

## Core Database Terms

### Database

A database is the whole storage system for one application.

Example future database name:

```text
studyguard_dev
```

### Table

A table stores one type of thing.

Example:

```text
users
courses
coursework
weekly_availability
```

### Row

A row is one record inside a table.

Example: one course row could represent `BIO 101`.

### Column

A column is one field on a table.

Example columns for a future `courses` table:

```text
id
user_id
name
code
instructor
term
color
target_grade
is_archived
created_at
updated_at
```

### Primary Key

A primary key uniquely identifies each row.

Most StudyGuard tables will use an `id` column as the primary key.

Example:

```text
courses.id
```

### Foreign Key

A foreign key points from one table to another table.

Example:

```text
courses.user_id -> users.id
```

This means each course belongs to one user.

### Constraint

A constraint is a rule enforced by the database.

Examples:

- Email must be unique.
- Course name cannot be empty.
- Estimated effort cannot be negative.
- A coursework item must belong to the current user.

### Index

An index helps PostgreSQL find rows faster.

Examples:

- Find all courses for one user.
- Find coursework due soon.
- Find active, incomplete coursework.

Indexes make reads faster, but too many indexes can slow down writes. We will add them only when they support real queries.

## SQL Basics

SQL is the language we use to talk to PostgreSQL.

### SELECT

Reads rows.

```sql
SELECT id, name, code
FROM courses
WHERE user_id = 'user-123';
```

Meaning:

```text
Give me this user's course IDs, names, and codes.
```

### INSERT

Creates a row.

```sql
INSERT INTO courses (user_id, name, code)
VALUES ('user-123', 'Biology I', 'BIO 101')
RETURNING id, name, code;
```

Meaning:

```text
Create a course and return the new course data.
```

### UPDATE

Changes existing rows.

```sql
UPDATE courses
SET name = 'Biology I Lab'
WHERE id = 'course-123'
AND user_id = 'user-123'
RETURNING id, name;
```

Meaning:

```text
Update this course, but only if it belongs to this user.
```

The `AND user_id = 'user-123'` part is an ownership check.

### DELETE

Removes rows.

```sql
DELETE FROM courses
WHERE id = 'course-123'
AND user_id = 'user-123';
```

Meaning:

```text
Delete this course, but only if it belongs to this user.
```

## Parameterized Queries

We should not build SQL by pasting user input into strings.

Unsafe idea:

```js
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

Safer idea:

```js
const sql = "SELECT * FROM users WHERE email = $1";
const values = [email];
```

The `$1` placeholder lets the PostgreSQL client send the user value separately from the SQL command.

This helps protect against SQL injection.

## How the Backend Will Use PostgreSQL

Later, a request will travel like this:

```text
Client -> Route -> Middleware -> Controller -> Service -> Database
Database -> Service -> Controller -> Response -> Client
```

Example future course creation flow:

```text
Client submits POST /api/courses
Auth middleware identifies the user
Controller reads req.body
Validator checks required fields
Service applies course rules
Database runs parameterized INSERT
Database returns the new row
Service returns clean data
Controller sends JSON response
Client updates the screen
```

## Why We Will Not Use an ORM First

An ORM is a library that lets code interact with a database through objects instead of writing SQL directly.

Examples include Prisma and Sequelize.

For StudyGuard's first version, we will use `pg` and SQL because the learning goal is to understand:

- Tables
- Rows
- Relationships
- Queries
- Foreign keys
- Ownership checks
- SQL injection protection

An ORM can be useful later, but it would hide too much while you are learning the backend.

## StudyGuard Data Relationships Preview

These are not final table definitions yet. They are the mental model for Stage 6.

### Users

A user owns almost everything in the MVP.

Relationship examples:

```text
users 1 -> many courses
users 1 -> many coursework items
users 1 -> many availability windows
users 1 -> many recommendations
```

### Courses

A course groups academic work.

Relationship examples:

```text
courses many -> 1 users
courses 1 -> many coursework items
```

### Coursework

Coursework stores assignments, projects, quizzes, tests, exams, readings, and personal study tasks.

Relationship examples:

```text
coursework many -> 1 users
coursework many -> 1 courses
coursework 1 -> many study sessions
```

Some coursework may not belong to a course, such as a personal study task. We will decide in Stage 6 whether `course_id` should be optional.

### Availability

Weekly availability stores reusable study windows.

Availability exceptions store one-time changes.

Relationship examples:

```text
weekly_availability many -> 1 users
availability_exceptions many -> 1 users
```

### Study Plans and Study Blocks

A study plan is a generated plan for a date range.

A study block is one scheduled block inside that plan.

Relationship examples:

```text
study_plans many -> 1 users
study_blocks many -> 1 study_plans
study_blocks many -> 1 coursework items
```

### Recommendations

Recommendations are suggestions that the student must review.

Relationship examples:

```text
recommendations many -> 1 users
recommendations many -> 1 coursework items
```

## Cascade Behavior

Cascade behavior controls what happens to related rows when a parent row is deleted.

Example:

```text
If a user deletes their account, their courses should also be deleted.
```

That is likely a cascade delete.

But for some actions, deleting data may be risky.

Example:

```text
If a student deletes a course, should coursework history disappear too?
```

For the MVP, we may prefer archiving courses instead of deleting them immediately. That protects historical progress data.

## What Data Should Not Be Stored

StudyGuard should not store:

- Plain text passwords
- Raw secret keys
- AI API keys in the database
- Unapproved AI-generated coursework as real coursework
- More syllabus text than needed
- Sensitive health diagnoses
- Private data in logs

Passwords will be hashed before storage in a later auth stage.

## Development vs Production Databases

Development database:

- Runs locally or in a development cloud database.
- Can contain fake sample data.
- Can be reset while learning.

Production database:

- Stores real user data.
- Needs stronger backups, secrets, access controls, and migration discipline.
- Should not be reset casually.

We will start with development.

## Exact Commands for This Stage

Check whether PostgreSQL tools are available:

```bash
psql --version
createdb --version
pg_isready
```

Check project formatting:

```bash
npm run format:check
```

Run existing backend tests:

```bash
npm run test:server
```

No database commands should be expected to work yet because PostgreSQL is not installed or not on `PATH`.

## Stage 5 Acceptance Criteria

Stage 5 is complete when:

- You can explain what a database table is.
- You can explain rows and columns.
- You can explain primary keys and foreign keys.
- You understand why StudyGuard uses ownership fields such as `user_id`.
- You understand why parameterized SQL protects against SQL injection.
- We have not created the real schema yet.
- You approve moving to Stage 6.

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

Before Stage 6, make sure you can answer these:

1. What is the difference between a table and a row?
2. Why does a course need a `user_id`?
3. What problem does a foreign key solve?
4. Why should we use `$1`, `$2`, and values instead of pasting user input into SQL?
