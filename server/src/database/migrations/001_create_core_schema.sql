CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
  planning_priority TEXT NOT NULL DEFAULT 'balance_deadlines_wellbeing' CHECK (
    planning_priority IN (
      'meet_deadlines',
      'prevent_burnout',
      'balance_deadlines_wellbeing',
      'custom'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  code TEXT CHECK (code IS NULL OR length(btrim(code)) BETWEEN 1 AND 40),
  instructor TEXT CHECK (
    instructor IS NULL
    OR length(btrim(instructor)) BETWEEN 1 AND 120
  ),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  term TEXT CHECK (term IS NULL OR length(btrim(term)) BETWEEN 1 AND 80),
  target_grade TEXT CHECK (
    target_grade IS NULL
    OR length(btrim(target_grade)) BETWEEN 1 AND 20
  ),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description TEXT,
  type TEXT NOT NULL CHECK (
    type IN (
      'assignment',
      'project',
      'quiz',
      'test',
      'exam',
      'reading',
      'study_task'
    )
  ),
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (
    difficulty IN ('easy', 'medium', 'hard', 'very_hard')
  ),
  estimated_minutes INTEGER NOT NULL DEFAULT 60 CHECK (estimated_minutes > 0),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    status IN (
      'not_started',
      'in_progress',
      'completed',
      'postponed',
      'missed',
      'archived'
    )
  ),
  grade_weight NUMERIC(5, 2) CHECK (
    grade_weight IS NULL
    OR (
      grade_weight >= 0
      AND grade_weight <= 100
    )
  ),
  topic TEXT CHECK (topic IS NULL OR length(btrim(topic)) BETWEEN 1 AND 120),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursework_dependencies (
  coursework_id UUID NOT NULL REFERENCES coursework(id) ON DELETE CASCADE,
  depends_on_coursework_id UUID NOT NULL REFERENCES coursework(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coursework_id, depends_on_coursework_id),
  CHECK (coursework_id <> depends_on_coursework_id)
);

CREATE TABLE weekly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (
    weekday >= 1
    AND weekday <= 7
  ),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time),
  UNIQUE (user_id, weekday, start_time, end_time)
);

CREATE TABLE availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('unavailable', 'extra_available')),
  is_full_day BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  reason TEXT CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (
      is_full_day = true
      AND start_time IS NULL
      AND end_time IS NULL
    )
    OR (
      is_full_day = false
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND start_time < end_time
    )
  )
);

CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_start_date DATE NOT NULL,
  plan_end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'archived')
  ),
  planning_priority TEXT NOT NULL CHECK (
    planning_priority IN (
      'meet_deadlines',
      'prevent_burnout',
      'balance_deadlines_wellbeing',
      'custom'
    )
  ),
  overload_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
    overload_status IN ('unknown', 'balanced', 'heavy', 'overloaded')
  ),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (plan_start_date <= plan_end_date)
);

CREATE TABLE study_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  coursework_id UUID REFERENCES coursework(id) ON DELETE SET NULL,
  block_type TEXT NOT NULL DEFAULT 'study' CHECK (
    block_type IN ('study', 'break', 'buffer')
  ),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'completed', 'missed', 'moved', 'cancelled')
  ),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_at < end_at)
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coursework_id UUID REFERENCES coursework(id) ON DELETE SET NULL,
  study_block_id UUID REFERENCES study_blocks(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'move_block',
      'split_task',
      'start_earlier',
      'add_break',
      'reestimate_effort',
      'seek_support',
      'postpone_lower_priority'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'edited')
  ),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  proposed_change JSONB NOT NULL DEFAULT '{}'::jsonb,
  edited_change JSONB,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coursework_id UUID REFERENCES coursework(id) ON DELETE SET NULL,
  study_block_id UUID REFERENCES study_blocks(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'timer')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    started_at IS NULL
    OR ended_at IS NULL
    OR started_at < ended_at
  )
);

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT current_date,
  energy_level SMALLINT CHECK (
    energy_level >= 1
    AND energy_level <= 5
  ),
  stress_level SMALLINT CHECK (
    stress_level >= 1
    AND stress_level <= 5
  ),
  focus_level SMALLINT CHECK (
    focus_level >= 1
    AND focus_level <= 5
  ),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, check_in_date)
);

CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  coursework_id UUID REFERENCES coursework(id) ON DELETE SET NULL,
  assessment_type TEXT NOT NULL CHECK (
    assessment_type IN ('assignment', 'project', 'quiz', 'test', 'exam')
  ),
  score NUMERIC(8, 2) NOT NULL CHECK (score >= 0),
  max_score NUMERIC(8, 2) NOT NULL CHECK (max_score > 0),
  grade_weight NUMERIC(5, 2) CHECK (
    grade_weight IS NULL
    OR (
      grade_weight >= 0
      AND grade_weight <= 100
    )
  ),
  topic TEXT CHECK (topic IS NULL OR length(btrim(topic)) BETWEEN 1 AND 120),
  is_unusual BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  graded_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_coursework_updated_at
BEFORE UPDATE ON coursework
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_weekly_availability_updated_at
BEFORE UPDATE ON weekly_availability
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_availability_exceptions_updated_at
BEFORE UPDATE ON availability_exceptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_study_plans_updated_at
BEFORE UPDATE ON study_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_study_blocks_updated_at
BEFORE UPDATE ON study_blocks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_recommendations_updated_at
BEFORE UPDATE ON recommendations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_study_sessions_updated_at
BEFORE UPDATE ON study_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_check_ins_updated_at
BEFORE UPDATE ON check_ins
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_grades_updated_at
BEFORE UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX courses_user_archived_idx
ON courses (user_id, is_archived);

CREATE INDEX coursework_user_status_due_idx
ON coursework (user_id, status, due_at);

CREATE INDEX coursework_user_course_idx
ON coursework (user_id, course_id);

CREATE INDEX coursework_user_due_idx
ON coursework (user_id, due_at)
WHERE due_at IS NOT NULL;

CREATE INDEX weekly_availability_user_weekday_idx
ON weekly_availability (user_id, weekday);

CREATE INDEX availability_exceptions_user_date_idx
ON availability_exceptions (user_id, exception_date);

CREATE INDEX study_plans_user_status_idx
ON study_plans (user_id, status, plan_start_date);

CREATE INDEX study_blocks_user_start_idx
ON study_blocks (user_id, start_at);

CREATE INDEX study_blocks_plan_start_idx
ON study_blocks (study_plan_id, start_at);

CREATE INDEX recommendations_user_status_idx
ON recommendations (user_id, status);

CREATE INDEX study_sessions_user_created_idx
ON study_sessions (user_id, created_at);

CREATE INDEX study_sessions_coursework_idx
ON study_sessions (coursework_id);

CREATE INDEX check_ins_user_date_idx
ON check_ins (user_id, check_in_date);

CREATE INDEX grades_user_course_idx
ON grades (user_id, course_id);

CREATE INDEX grades_user_coursework_idx
ON grades (user_id, coursework_id);

