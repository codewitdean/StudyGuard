import { useEffect, useState } from "react";
import { listCoursework } from "../api/courseworkApi.js";
import { getProgressSummary } from "../api/progressApi.js";
import { listRecommendations } from "../api/recommendationApi.js";
import { getStudyPlan, listStudyPlans } from "../api/studyPlanApi.js";

const dashboardPriorityStyles = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-50 text-blue-800",
  high: "bg-amber-50 text-amber-800",
  urgent: "bg-red-50 text-red-800",
};

const dashboardStatusStyles = {
  active: "bg-emerald-50 text-emerald-800",
  archived: "bg-slate-100 text-slate-700",
  cancelled: "bg-slate-100 text-slate-700",
  completed: "bg-emerald-50 text-emerald-800",
  draft: "bg-amber-50 text-amber-800",
  in_progress: "bg-blue-50 text-blue-800",
  missed: "bg-red-50 text-red-800",
  moved: "bg-blue-50 text-blue-800",
  not_started: "bg-slate-100 text-slate-700",
  planned: "bg-emerald-50 text-emerald-800",
  postponed: "bg-amber-50 text-amber-800",
};

const workloadStatusStyles = {
  balanced: "border-emerald-200 bg-emerald-50 text-emerald-800",
  heavy: "border-amber-200 bg-amber-50 text-amber-800",
  overloaded: "border-red-200 bg-red-50 text-red-800",
  unknown: "border-slate-200 bg-white text-slate-700",
};

function getEmptyDashboardData() {
  return {
    dueTodayTasks: [],
    nextBlocks: [],
    openTasks: [],
    overdueTasks: [],
    planSummary: null,
    progress: null,
    recommendations: [],
    selectedPlan: null,
    taskPreviewTasks: [],
    todayBlocks: [],
    upcomingDeadlines: [],
    workloadStatus: "unknown",
  };
}

function getLocalDateString(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getLocalDateStringFromValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return getLocalDateString(date);
}

function isSameLocalDate(value, dateString) {
  return getLocalDateStringFromValue(value) === dateString;
}

function formatOptionLabel(value) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatDashboardMinutes(minutes, emptyLabel = "0m") {
  if (minutes === null || minutes === undefined || minutes === "") {
    return emptyLabel;
  }

  const numericMinutes = Number(minutes);

  if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    return emptyLabel;
  }

  const hours = Math.floor(numericMinutes / 60);
  const remainingMinutes = numericMinutes % 60;

  if (hours === 0) {
    return numericMinutes + "m";
  }

  if (remainingMinutes === 0) {
    return hours + "h";
  }

  return hours + "h " + remainingMinutes + "m";
}

function formatDashboardDateTime(value) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDashboardTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(date);
}

function formatDashboardTimeRange(startAt, endAt) {
  const startTime = formatDashboardTime(startAt);
  const endTime = formatDashboardTime(endAt);

  if (!startTime && !endTime) {
    return "No time set";
  }

  if (!endTime) {
    return startTime;
  }

  return startTime + " - " + endTime;
}

function getCourseworkCourseLabel(coursework) {
  const course = coursework.course;

  if (!course) {
    return "No course";
  }

  return [course.code, course.name].filter(Boolean).join(" - ") || "No course";
}

function getStudyBlockTitle(studyBlock) {
  if (studyBlock.coursework) {
    return studyBlock.coursework.title;
  }

  if (studyBlock.blockType === "break") {
    return "Break";
  }

  if (studyBlock.blockType === "buffer") {
    return "Buffer";
  }

  return "Study block";
}

function getStudyBlockCourseLabel(studyBlock) {
  if (!studyBlock.coursework?.course) {
    return formatOptionLabel(studyBlock.blockType);
  }

  return getCourseworkCourseLabel(studyBlock.coursework);
}

function getStudyBlockMinutes(studyBlock) {
  if (!studyBlock.startAt || !studyBlock.endAt) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(studyBlock.endAt).getTime() -
        new Date(studyBlock.startAt).getTime()) /
        60000,
    ),
  );
}

function sortCourseworkByDueDate(coursework) {
  return [...coursework].sort((left, right) => {
    if (!left.dueAt && !right.dueAt) {
      return 0;
    }

    if (!left.dueAt) {
      return 1;
    }

    if (!right.dueAt) {
      return -1;
    }

    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  });
}

function sortStudyBlocksByStart(studyBlocks) {
  return [...studyBlocks].sort((left, right) => {
    if (!left.startAt && !right.startAt) {
      return 0;
    }

    if (!left.startAt) {
      return 1;
    }

    if (!right.startAt) {
      return -1;
    }

    return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
  });
}

function getSelectedStudyPlan(studyPlans) {
  return (
    studyPlans.find((studyPlan) => studyPlan.status === "active") ??
    studyPlans.find((studyPlan) => studyPlan.status === "draft") ??
    null
  );
}

function getOrderedDashboardDeadlines(openTasks, overdueTasks, dueTodayTasks) {
  const seenIds = new Set();
  const orderedTasks = [];

  for (const task of [...overdueTasks, ...dueTodayTasks, ...openTasks]) {
    if (seenIds.has(task.id)) {
      continue;
    }

    seenIds.add(task.id);
    orderedTasks.push(task);
  }

  return orderedTasks.slice(0, 5);
}

function buildDashboardData({
  openCourseworkData,
  overdueCourseworkData,
  progressData,
  recommendationsData,
  selectedPlan,
  studyPlanData,
}) {
  const now = new Date();
  const today = getLocalDateString(now);
  const openTasks = sortCourseworkByDueDate(
    openCourseworkData?.coursework ?? [],
  );
  const overdueTasks = sortCourseworkByDueDate(
    overdueCourseworkData?.coursework ?? [],
  );
  const dueTodayTasks = openTasks.filter((task) =>
    isSameLocalDate(task.dueAt, today),
  );
  const taskPreviewTasks = (
    dueTodayTasks.length ? dueTodayTasks : openTasks
  ).slice(0, 5);
  const upcomingDeadlines = getOrderedDashboardDeadlines(
    openTasks,
    overdueTasks,
    dueTodayTasks,
  );
  const plan = studyPlanData?.studyPlan ?? selectedPlan;
  const studyBlocks = sortStudyBlocksByStart(studyPlanData?.studyBlocks ?? []);
  const todayBlocks = studyBlocks.filter((studyBlock) =>
    isSameLocalDate(studyBlock.startAt, today),
  );
  const nextBlocks = studyBlocks
    .filter(
      (studyBlock) =>
        studyBlock.startAt &&
        new Date(studyBlock.startAt).getTime() >= now.getTime(),
    )
    .slice(0, 3);

  return {
    dueTodayTasks,
    nextBlocks,
    openTasks,
    overdueTasks,
    planSummary: studyPlanData?.summary ?? selectedPlan?.summary ?? null,
    progress: progressData?.progress ?? null,
    recommendations: recommendationsData?.recommendations ?? [],
    selectedPlan: plan ?? null,
    taskPreviewTasks,
    todayBlocks,
    upcomingDeadlines,
    workloadStatus: plan?.overloadStatus ?? "unknown",
  };
}

function getWorkloadStatusLabel(status) {
  const labels = {
    balanced: "Workload status: Balanced",
    heavy: "Workload status: Heavy",
    overloaded: "Workload status: Overloaded",
    unknown: "Workload status: Waiting for study plan",
  };

  return labels[status] ?? labels.unknown;
}

function getWorkloadStatusClassName(status) {
  return (
    "rounded-md border px-3 py-2 text-sm font-medium " +
    (workloadStatusStyles[status] ?? workloadStatusStyles.unknown)
  );
}

function DashboardBadge({ children, className }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        className
      }
    >
      {children}
    </span>
  );
}

function DashboardMetric({
  actionLabel,
  helper,
  isLoading,
  label,
  onAction,
  value,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-h-28 flex-col justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {isLoading ? "..." : value}
          </p>
          <p className="mt-1 text-sm text-slate-600">{helper}</p>
        </div>
        {onAction ? (
          <button
            className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function DashboardSection({
  actionLabel,
  children,
  emptyText,
  isEmpty,
  isLoading,
  onAction,
  title,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <h3 className="text-base font-semibold">{title}</h3>
        {onAction ? (
          <button
            className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          Loading dashboard data.
        </p>
      ) : isEmpty ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}

function DashboardTaskItem({ isDeadline, task }) {
  const isOverdue = Boolean(
    task.dueAt && new Date(task.dueAt).getTime() < Date.now(),
  );

  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {task.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {getCourseworkCourseLabel(task)}
          </p>
        </div>
        <DashboardBadge
          className={
            dashboardPriorityStyles[task.priority] ??
            dashboardPriorityStyles.medium
          }
        >
          {formatOptionLabel(task.priority)}
        </DashboardBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>
          {isOverdue ? "Overdue" : isDeadline ? "Due" : "Target"}:{" "}
          {formatDashboardDateTime(task.dueAt)}
        </span>
        <span>
          {formatDashboardMinutes(task.estimatedMinutes, "No estimate")}
        </span>
        <DashboardBadge
          className={
            dashboardStatusStyles[task.status] ??
            dashboardStatusStyles.not_started
          }
        >
          {formatOptionLabel(task.status)}
        </DashboardBadge>
      </div>
    </li>
  );
}

function DashboardStudyBlockItem({ studyBlock }) {
  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {getStudyBlockTitle(studyBlock)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {getStudyBlockCourseLabel(studyBlock)}
          </p>
        </div>
        <DashboardBadge
          className={
            dashboardStatusStyles[studyBlock.status] ??
            dashboardStatusStyles.planned
          }
        >
          {formatOptionLabel(studyBlock.status)}
        </DashboardBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>
          {formatDashboardTimeRange(studyBlock.startAt, studyBlock.endAt)}
        </span>
        <span>{formatDashboardMinutes(getStudyBlockMinutes(studyBlock))}</span>
        <span>{formatOptionLabel(studyBlock.blockType)}</span>
      </div>
    </li>
  );
}

function DashboardWorkloadSummary({
  onRecommendationsClick,
  planSummary,
  progress,
  recommendations,
  selectedPlan,
}) {
  const taskCounts = progress?.taskCounts ?? {};
  const studyTime = progress?.studyTime ?? {};
  const estimateAccuracy = progress?.estimateAccuracy;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">
            Completed
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {taskCounts.completed ?? 0}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">
            Open Due
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {taskCounts.open ?? 0}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">Missed</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {taskCounts.missed ?? 0}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">
            Postponed
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {taskCounts.postponed ?? 0}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">Logged</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatDashboardMinutes(studyTime.totalMinutes)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium uppercase text-slate-500">
            Scheduled
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatDashboardMinutes(planSummary?.scheduledMinutes)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-800">Plan</span>
          <DashboardBadge
            className={
              dashboardStatusStyles[selectedPlan?.status] ??
              dashboardStatusStyles.draft
            }
          >
            {selectedPlan ? formatOptionLabel(selectedPlan.status) : "No Plan"}
          </DashboardBadge>
          <DashboardBadge
            className={
              workloadStatusStyles[selectedPlan?.overloadStatus] ??
              workloadStatusStyles.unknown
            }
          >
            {formatOptionLabel(selectedPlan?.overloadStatus ?? "unknown")}
          </DashboardBadge>
        </div>
        <p>
          Estimate accuracy:{" "}
          {formatOptionLabel(estimateAccuracy?.label ?? "not_enough_data")}
        </p>
        {recommendations.length ? (
          <button
            className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onRecommendationsClick}
            type="button"
          >
            {recommendations.length} recommendation
            {recommendations.length === 1 ? "" : "s"} need review
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DashboardView({
  authToken,
  currentUser,
  isChecking,
  onAuthExpired,
  onRefreshCurrentUser,
  onViewChange,
  onWorkloadStatusChange,
  statusMessage,
}) {
  const [dashboardData, setDashboardData] = useState(getEmptyDashboardData);
  const [dashboardError, setDashboardError] = useState("");
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadDashboard() {
      setDashboardError("");
      setIsDashboardLoading(true);
      onWorkloadStatusChange("unknown");

      try {
        const [
          openCourseworkData,
          overdueCourseworkData,
          studyPlansData,
          recommendationsData,
          progressData,
        ] = await Promise.all([
          listCoursework(authToken, { status: "open", sort: "dueDate" }),
          listCoursework(authToken, {
            status: "open",
            due: "overdue",
            sort: "dueDate",
          }),
          listStudyPlans(authToken, { status: "current" }),
          listRecommendations(authToken),
          getProgressSummary(authToken),
        ]);
        const selectedPlan = getSelectedStudyPlan(
          studyPlansData?.studyPlans ?? [],
        );
        const studyPlanData = selectedPlan
          ? await getStudyPlan(authToken, selectedPlan.id)
          : null;
        const nextDashboardData = buildDashboardData({
          openCourseworkData,
          overdueCourseworkData,
          progressData,
          recommendationsData,
          selectedPlan,
          studyPlanData,
        });

        if (!isCurrent) {
          return;
        }

        setDashboardData(nextDashboardData);
        setLastRefreshedAt(new Date());
        onWorkloadStatusChange(nextDashboardData.workloadStatus);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setDashboardError(error.message);
        onWorkloadStatusChange("unknown");
      } finally {
        if (isCurrent) {
          setIsDashboardLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isCurrent = false;
    };
  }, [authToken, onAuthExpired, onWorkloadStatusChange, refreshKey]);

  const isInitialLoading = isDashboardLoading && !lastRefreshedAt;
  const studyBlocksToShow = dashboardData.todayBlocks.length
    ? dashboardData.todayBlocks
    : dashboardData.nextBlocks;
  const studyBlockEmptyText = dashboardData.selectedPlan
    ? "No study blocks are scheduled today."
    : "Generate a study plan to see study blocks here.";

  function handleDashboardRefresh() {
    setRefreshKey((currentRefreshKey) => currentRefreshKey + 1);
  }

  return (
    <>
      {statusMessage ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-base font-semibold">Profile</h3>
            <p className="mt-1 text-sm text-slate-600">
              {currentUser.email} -{" "}
              {formatOptionLabel(currentUser.planningPriority)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lastRefreshedAt
                ? "Dashboard updated " +
                  formatDashboardDateTime(lastRefreshedAt)
                : "Dashboard has not loaded yet."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isDashboardLoading}
              onClick={handleDashboardRefresh}
              type="button"
            >
              {isDashboardLoading ? "Refreshing..." : "Refresh Data"}
            </button>
            <button
              className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isChecking}
              onClick={onRefreshCurrentUser}
              type="button"
            >
              {isChecking ? "Refreshing..." : "Refresh Profile"}
            </button>
          </div>
        </div>
      </section>

      {dashboardError ? (
        <div
          aria-live="polite"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {dashboardError}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          actionLabel="Open Coursework"
          helper="Still active"
          isLoading={isInitialLoading}
          label="Open Tasks"
          onAction={() => onViewChange("Coursework")}
          value={dashboardData.openTasks.length}
        />
        <DashboardMetric
          actionLabel="View Tasks"
          helper="Due on your local date"
          isLoading={isInitialLoading}
          label="Due Today"
          onAction={() => onViewChange("Coursework")}
          value={dashboardData.dueTodayTasks.length}
        />
        <DashboardMetric
          actionLabel="Open Progress"
          helper="Logged this week"
          isLoading={isInitialLoading}
          label="Study Time"
          onAction={() => onViewChange("Progress")}
          value={formatDashboardMinutes(
            dashboardData.progress?.studyTime?.totalMinutes,
          )}
        />
        <DashboardMetric
          actionLabel="Review"
          helper="Pending or edited"
          isLoading={isInitialLoading}
          label="Recommendations"
          onAction={() => onViewChange("Recommendations")}
          value={dashboardData.recommendations.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardSection
          actionLabel="Manage Coursework"
          emptyText={
            dashboardData.openTasks.length
              ? "No coursework is due today."
              : "Add coursework to start building your dashboard."
          }
          isEmpty={!dashboardData.taskPreviewTasks.length}
          isLoading={isInitialLoading}
          onAction={() => onViewChange("Coursework")}
          title="Today's Tasks"
        >
          <ul className="grid gap-3">
            {dashboardData.taskPreviewTasks.map((task) => (
              <DashboardTaskItem key={task.id} task={task} />
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          actionLabel="Open Study Plan"
          emptyText={studyBlockEmptyText}
          isEmpty={!studyBlocksToShow.length}
          isLoading={isInitialLoading}
          onAction={() => onViewChange("Study Plan")}
          title="Study Blocks"
        >
          <ul className="grid gap-3">
            {studyBlocksToShow.map((studyBlock) => (
              <DashboardStudyBlockItem
                key={studyBlock.id}
                studyBlock={studyBlock}
              />
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          actionLabel="All Deadlines"
          emptyText="No deadlines have been added."
          isEmpty={!dashboardData.upcomingDeadlines.length}
          isLoading={isInitialLoading}
          onAction={() => onViewChange("Coursework")}
          title="Upcoming Deadlines"
        >
          <ul className="grid gap-3">
            {dashboardData.upcomingDeadlines.map((task) => (
              <DashboardTaskItem isDeadline key={task.id} task={task} />
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          actionLabel="Open Progress"
          emptyText="Progress and workload will appear after coursework or study sessions exist."
          isEmpty={!dashboardData.progress && !dashboardData.selectedPlan}
          isLoading={isInitialLoading}
          onAction={() => onViewChange("Progress")}
          title="Weekly Workload"
        >
          <DashboardWorkloadSummary
            onRecommendationsClick={() => onViewChange("Recommendations")}
            planSummary={dashboardData.planSummary}
            progress={dashboardData.progress}
            recommendations={dashboardData.recommendations}
            selectedPlan={dashboardData.selectedPlan}
          />
        </DashboardSection>
      </div>
    </>
  );
}

export {
  getWorkloadStatusClassName as getDashboardWorkloadStatusClassName,
  getWorkloadStatusLabel as getDashboardWorkloadStatusLabel,
};

export default DashboardView;
