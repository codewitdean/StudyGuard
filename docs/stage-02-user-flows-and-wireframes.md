# Stage 2: User Flows and Low-Fidelity Wireframes

## Goal

The goal of Stage 2 is to decide how a student moves through StudyGuard before we create backend routes, database tables, or frontend screens.

This stage connects the product idea to the application structure:

- User flows tell us what actions the app must support.
- Wireframes tell us what screens those actions belong to.
- Backend planning becomes easier because each screen implies data the API must provide.

We are still not coding the application yet.

## Target User

The MVP user is one individual student managing their own academic workload in a private account.

The first version does not include:

- Advisors
- Instructors
- Parents
- Classrooms
- Shared study groups
- Team scheduling

## MVP User Flows

### Flow 1: Create an Account and Start Safely

Purpose: A student needs a private account so their courses, deadlines, availability, and progress are protected.

Steps:

1. Student opens StudyGuard.
2. Student registers with name, email, and password.
3. Backend validates the request.
4. Backend hashes the password.
5. Backend creates the user.
6. Backend returns an authentication token.
7. Frontend stores the token safely enough for the MVP.
8. Student lands on the dashboard.

Backend learning involved:

- Request bodies
- Validation
- Password hashing
- JSON Web Tokens
- Authentication middleware
- Safe error responses

### Flow 2: Add Courses

Purpose: Coursework needs to belong to a course so the student can understand workload by class.

Steps:

1. Student opens Courses.
2. Student creates a course with name, code, instructor, term, color, and target grade.
3. Backend checks that the student is authenticated.
4. Backend saves the course with the current user's ID.
5. Student sees the course in the active course list.

Backend learning involved:

- Protected routes
- Foreign keys
- Ownership
- SQL inserts
- SQL selects filtered by user ID

### Flow 3: Add Coursework

Purpose: The scheduling engine needs deadlines, effort estimates, priorities, and status.

Steps:

1. Student opens Coursework.
2. Student creates an assignment, quiz, exam, reading, project, or study task.
3. Student chooses a course if the item belongs to one.
4. Student enters due date, effort estimate, priority, difficulty, and notes.
5. Backend validates the fields.
6. Backend confirms the selected course belongs to the student.
7. Backend saves the coursework item.
8. Student sees the item in the dashboard and coursework list.

Backend learning involved:

- Route parameters
- Request bodies
- Validation with Zod
- Resource ownership checks
- Relational data

### Flow 4: Set Weekly Availability

Purpose: StudyGuard cannot make a realistic plan unless it knows when the student can study.

Steps:

1. Student opens Availability.
2. Student adds reusable weekly study windows.
3. Example: Monday, 6:00 PM to 9:00 PM.
4. Backend saves each time window for the authenticated user.
5. Student can edit or remove weekly windows.

Backend learning involved:

- Reusable data models
- Time fields
- Querying records by weekday
- Validation for time ranges

### Flow 5: Add One-Time Exceptions

Purpose: Real weeks are messy. Work shifts, travel, illness, and events can change the normal study plan.

Steps:

1. Student opens Availability.
2. Student adds an exception for a specific date or date range.
3. Exception can remove availability or add extra available time.
4. Backend validates that the exception has a real date and valid times.
5. Scheduling engine combines weekly availability with exceptions.

Backend learning involved:

- Date ranges
- Business rules
- Scheduling edge cases
- Conflict handling

### Flow 6: Generate a Study Plan

Purpose: This is the core backend feature. StudyGuard turns coursework and availability into daily study blocks.

Steps:

1. Student opens Dashboard or Study Plan.
2. Frontend requests a plan for the next 7 days.
3. Backend loads the student's coursework, availability, exceptions, and planning priority.
4. Scheduling service calculates available study time.
5. Scheduling service sorts work by urgency, priority, effort, and difficulty.
6. Scheduling service creates study blocks.
7. Backend returns daily tasks, calendar blocks, overload warnings, and explanations.
8. Student reviews the plan.

Backend learning involved:

- Service layer
- Business logic
- Deterministic algorithms
- Testable scheduling rules
- Separating HTTP logic from planning logic

### Flow 7: Review Recommendations

Purpose: StudyGuard should explain suggestions but should not silently change the student's schedule.

Steps:

1. Student opens Recommendations.
2. Student reviews suggestions such as moving a block, splitting a task, or starting earlier.
3. Student approves, edits, or rejects each recommendation.
4. Backend saves only approved changes.
5. Dashboard updates after approval.

Backend learning involved:

- Recommendation status
- Batch updates
- Approval workflow
- Audit-friendly behavior

### Flow 8: Track Progress

Purpose: StudyGuard becomes more useful when it knows what the student completed and how long work actually took.

Steps:

1. Student marks a task complete or logs study time.
2. Backend records completion status and actual time spent.
3. Dashboard updates progress and remaining workload.
4. Later versions use this data for adaptive effort estimates.

Backend learning involved:

- State changes
- Partial updates
- Historical records
- Metrics from SQL queries

## MVP Navigation

The main application navigation should be simple:

- Dashboard
- Courses
- Coursework
- Availability
- Study Plan
- Recommendations
- Progress
- Profile

Settings can wait until later unless a profile field needs to be edited.

## Low-Fidelity Wireframes

These are rough layouts, not final visual design.

### Auth Screen

```text
+------------------------------------------------+
| StudyGuard                                     |
|                                                |
| Plan your academic workload before it piles up |
|                                                |
| [ Name ]                         Register tab  |
| [ Email ]                        Login tab     |
| [ Password ]                                   |
|                                                |
| [ Create Account ]                            |
|                                                |
| Already have an account? Log in                |
+------------------------------------------------+
```

Important backend data:

- name
- email
- password

Important states:

- loading
- validation error
- duplicate email
- successful authentication

### Dashboard

```text
+----------------------------------------------------------------+
| StudyGuard                         Search     Profile           |
+------------+---------------------------------------------------+
| Dashboard  | Today                                             |
| Courses    |                                                   |
| Coursework | [ Workload Status: Balanced / Heavy / Overloaded ] |
| Availability                                                   |
| Study Plan |                                                   |
| Recs       | Today's Tasks             Today's Study Blocks     |
| Progress   | - Math problem set        4:00-5:00 PM Biology     |
| Profile    | - Read history chapter    6:00-7:30 PM Math        |
|            |                                                   |
|            | Upcoming Deadlines        Weekly Workload          |
|            | - Chem quiz Friday        Required: 12h            |
|            | - Essay Sunday            Available: 10h           |
+------------+---------------------------------------------------+
```

Important backend data:

- today's coursework
- generated study blocks
- upcoming deadlines
- required hours
- available hours
- overload warnings
- pending recommendations

### Courses Screen

```text
+---------------------------------------------------------------+
| Courses                                            [ + Course ] |
+---------------------------------------------------------------+
| Active Courses                                                |
|                                                               |
| [ BIO 101 ] Biology I      Spring 2027      Target: A-        |
| [ MATH 120 ] Calculus      Spring 2027      Target: B+        |
| [ HIST 210 ] World Hist.   Spring 2027      Target: A         |
|                                                               |
| Archived Courses                                              |
+---------------------------------------------------------------+
```

Important backend data:

- course name
- course code
- instructor
- color
- term
- target grade
- archived status

### Coursework Screen

```text
+----------------------------------------------------------------+
| Coursework                                      [ + Coursework ] |
+----------------------------------------------------------------+
| Filters: Course [All] Type [All] Status [Open] Sort [Due date]  |
|                                                                |
| Title                 Course      Due          Effort  Status   |
| Biology lab report    BIO 101     Tue 9 PM     3h      Open     |
| Calculus problem set  MATH 120    Thu 5 PM     2h      Open     |
| History essay         HIST 210    Sun 11 PM    5h      Drafting |
+----------------------------------------------------------------+
```

Important backend data:

- title
- course ID
- type
- due date
- priority
- difficulty
- estimated effort
- status
- grade weight
- notes

### Availability Screen

```text
+----------------------------------------------------------------+
| Availability                                                   |
+----------------------------------------------------------------+
| Weekly Template                         One-Time Exceptions     |
|                                                                |
| Monday       6:00 PM - 9:00 PM          Aug 15: Unavailable     |
| Tuesday      No study time              Aug 17: + 2 hours       |
| Wednesday    4:00 PM - 7:00 PM                                  |
| Thursday     6:00 PM - 8:00 PM                                  |
| Friday       3:00 PM - 5:00 PM                                  |
|                                                                |
| [ + Weekly Window ]                     [ + Exception ]         |
+----------------------------------------------------------------+
```

Important backend data:

- weekday
- start time
- end time
- exception date
- exception type
- reason

### Study Plan Screen

```text
+----------------------------------------------------------------+
| Study Plan                                Range: Next 7 days    |
+----------------------------------------------------------------+
| Monday                                                         |
| 4:00-5:00 PM  Biology lab report                               |
| 5:00-5:10 PM  Break                                            |
| 5:10-6:10 PM  Calculus problem set                             |
|                                                                |
| Tuesday                                                        |
| No available study time                                        |
|                                                                |
| Warning                                                        |
| Required effort is 12 hours, but availability is 10 hours.      |
+----------------------------------------------------------------+
```

Important backend data:

- date
- study block start and end
- coursework item
- break blocks
- overload status
- explanation

### Recommendations Screen

```text
+----------------------------------------------------------------+
| Recommendations                              [ Approve Selected ] |
+----------------------------------------------------------------+
| [ ] Start History essay one day earlier                         |
|     Reason: The essay is large and due near another deadline.    |
|     [ Edit ] [ Reject ]                                         |
|                                                                |
| [ ] Split Biology lab report into two sessions                  |
|     Reason: Estimated effort is over 2 hours.                    |
|     [ Edit ] [ Reject ]                                         |
+----------------------------------------------------------------+
```

Important backend data:

- recommendation type
- related coursework item
- proposed change
- reason
- status
- approved timestamp

### Progress Screen

```text
+----------------------------------------------------------------+
| Progress                                                       |
+----------------------------------------------------------------+
| This Week                                                      |
| Completed tasks: 6                                             |
| Missed tasks: 1                                                |
| Study time: 8.5h                                               |
| Estimate accuracy: Usually close                               |
|                                                                |
| Recent Sessions                                                |
| Biology lab report     75 min                                  |
| Calculus practice      45 min                                  |
+----------------------------------------------------------------+
```

Important backend data:

- completed tasks
- missed tasks
- postponed tasks
- actual time spent
- study sessions
- estimate accuracy

## First Backend Request Trace Preview

We will explain this in more detail during the backend stages, but this is the shape we are designing for:

```text
Client -> Route -> Middleware -> Controller -> Service -> Database
Database -> Service -> Controller -> Response -> Client
```

Example from the Courses flow:

```text
Client submits "Create Course"
POST /api/courses
auth middleware checks JWT
course controller reads the request
course service applies business rules
database inserts the course with user_id
service returns the new course
controller sends JSON response
frontend displays the course
```

## Features That Should Wait

These are valuable, but they should wait until the core app is working:

- AI syllabus extraction
- AI effort estimation
- AI-generated explanations
- Email reminders
- Calendar integrations
- Instructor or advisor sharing
- Advanced performance analytics
- Automated course-support level changes

## Stage 2 Acceptance Criteria

Stage 2 is complete when:

- The MVP user journey is clear.
- The main screens are identified.
- Each screen has a rough layout.
- Each screen is connected to backend data needs.
- We know which features are intentionally postponed.
- You approve this screen and flow direction before Stage 3.

## Running Checklist

- Stage 1: Product definition and MVP boundaries - complete
- Stage 2: User flows and low-fidelity wireframes - complete
- Stage 3: Technology setup and folder structure - not started
- Stage 4: Backend request-and-response fundamentals - not started
- Stage 5: PostgreSQL and database fundamentals - not started
- Stage 6: Database schema and migrations - not started
- Stage 7: Basic Express server and health endpoint - not started
- Stage 8: Registration, login, and protected routes - not started

## Understanding Check

Before Stage 3, make sure you can answer these:

1. Why does StudyGuard need availability before it can create a realistic study plan?
2. Why should recommendations require approval before changing a schedule?
3. Why is AI syllabus extraction postponed until after the core backend exists?
