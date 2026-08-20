const minimumBlockMinutes = 25;
const preferredBlockMinutes = 90;
const defaultFullDayExtraStartMinutes = 9 * 60;
const defaultFullDayExtraEndMinutes = 21 * 60;

const priorityWeights = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const difficultyWeights = {
  very_hard: 4,
  hard: 3,
  medium: 2,
  easy: 1,
};

function parseDateParts(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function createLocalDate(dateString) {
  const { year, month, day } = parseDateParts(dateString);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function addDays(dateString, days) {
  const date = createLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

function getWeekday(dateString) {
  const weekday = createLocalDate(dateString).getDay();
  return weekday === 0 ? 7 : weekday;
}

function parseTimeMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function combineDateAndMinutes(dateString, minutes) {
  const { year, month, day } = parseDateParts(dateString);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return new Date(year, month - 1, day, hours, remainingMinutes, 0, 0);
}

function getDurationMinutes(startAt, endAt) {
  return Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60000));
}

function cloneSlot(slot) {
  return {
    date: slot.date,
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
  };
}

function subtractUnavailableSlot(slots, unavailableStart, unavailableEnd) {
  const nextSlots = [];

  for (const slot of slots) {
    if (
      unavailableEnd <= slot.startMinutes ||
      unavailableStart >= slot.endMinutes
    ) {
      nextSlots.push(slot);
      continue;
    }

    if (unavailableStart > slot.startMinutes) {
      nextSlots.push({
        ...slot,
        endMinutes: Math.min(unavailableStart, slot.endMinutes),
      });
    }

    if (unavailableEnd < slot.endMinutes) {
      nextSlots.push({
        ...slot,
        startMinutes: Math.max(unavailableEnd, slot.startMinutes),
      });
    }
  }

  return nextSlots;
}

function mergeSlots(slots) {
  const sortedSlots = slots
    .filter((slot) => slot.startMinutes < slot.endMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const mergedSlots = [];

  for (const slot of sortedSlots) {
    const previousSlot = mergedSlots.at(-1);

    if (!previousSlot || slot.startMinutes > previousSlot.endMinutes) {
      mergedSlots.push(cloneSlot(slot));
      continue;
    }

    previousSlot.endMinutes = Math.max(
      previousSlot.endMinutes,
      slot.endMinutes,
    );
  }

  return mergedSlots;
}

function expandWeeklyAvailability({ startDate, endDate, weeklyAvailability }) {
  const dates = getDateRange(startDate, endDate);
  const slotsByDate = new Map(dates.map((date) => [date, []]));

  for (const date of dates) {
    const weekday = getWeekday(date);
    const matchingWindows = weeklyAvailability.filter(
      (availabilityWindow) => availabilityWindow.weekday === weekday,
    );

    slotsByDate.set(
      date,
      matchingWindows.map((availabilityWindow) => ({
        date,
        startMinutes: parseTimeMinutes(availabilityWindow.startTime),
        endMinutes: parseTimeMinutes(availabilityWindow.endTime),
      })),
    );
  }

  return slotsByDate;
}

function applyAvailabilityExceptions(slotsByDate, availabilityExceptions) {
  for (const availabilityException of availabilityExceptions) {
    const currentSlots = slotsByDate.get(availabilityException.exceptionDate);

    if (!currentSlots) {
      continue;
    }

    if (availabilityException.type === "unavailable") {
      if (availabilityException.isFullDay) {
        slotsByDate.set(availabilityException.exceptionDate, []);
        continue;
      }

      slotsByDate.set(
        availabilityException.exceptionDate,
        subtractUnavailableSlot(
          currentSlots,
          parseTimeMinutes(availabilityException.startTime),
          parseTimeMinutes(availabilityException.endTime),
        ),
      );
      continue;
    }

    const extraSlot = availabilityException.isFullDay
      ? {
          date: availabilityException.exceptionDate,
          startMinutes: defaultFullDayExtraStartMinutes,
          endMinutes: defaultFullDayExtraEndMinutes,
        }
      : {
          date: availabilityException.exceptionDate,
          startMinutes: parseTimeMinutes(availabilityException.startTime),
          endMinutes: parseTimeMinutes(availabilityException.endTime),
        };

    slotsByDate.set(availabilityException.exceptionDate, [
      ...currentSlots,
      extraSlot,
    ]);
  }

  for (const [date, slots] of slotsByDate.entries()) {
    slotsByDate.set(date, mergeSlots(slots));
  }
}

function buildAvailableSlots({
  startDate,
  endDate,
  weeklyAvailability,
  availabilityExceptions,
}) {
  const slotsByDate = expandWeeklyAvailability({
    startDate,
    endDate,
    weeklyAvailability,
  });
  applyAvailabilityExceptions(slotsByDate, availabilityExceptions);

  return [...slotsByDate.values()]
    .flat()
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.startMinutes - b.startMinutes;
      }

      return a.date.localeCompare(b.date);
    })
    .map((slot) => {
      const startAt = combineDateAndMinutes(slot.date, slot.startMinutes);
      const endAt = combineDateAndMinutes(slot.date, slot.endMinutes);

      return {
        date: slot.date,
        cursor: startAt,
        startAt,
        endAt,
      };
    });
}

function compareDueDates(a, b) {
  if (a.dueAt && b.dueAt) {
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  }

  if (a.dueAt) {
    return -1;
  }

  if (b.dueAt) {
    return 1;
  }

  return 0;
}

function compareCoursework(a, b, planningPriority) {
  const dueDateComparison = compareDueDates(a, b);
  const priorityComparison =
    (priorityWeights[b.priority] ?? 0) - (priorityWeights[a.priority] ?? 0);
  const difficultyComparison =
    (difficultyWeights[b.difficulty] ?? 0) -
    (difficultyWeights[a.difficulty] ?? 0);
  const gradeWeightComparison = (b.gradeWeight ?? 0) - (a.gradeWeight ?? 0);

  if (planningPriority === "meet_deadlines") {
    return (
      dueDateComparison ||
      priorityComparison ||
      difficultyComparison ||
      gradeWeightComparison ||
      a.title.localeCompare(b.title)
    );
  }

  if (planningPriority === "prevent_burnout") {
    return (
      dueDateComparison ||
      difficultyComparison ||
      priorityComparison ||
      gradeWeightComparison ||
      a.title.localeCompare(b.title)
    );
  }

  return (
    dueDateComparison ||
    priorityComparison ||
    difficultyComparison ||
    gradeWeightComparison ||
    a.title.localeCompare(b.title)
  );
}

function getScheduleExplanation(courseworkItem) {
  if (courseworkItem.dueAt && priorityWeights[courseworkItem.priority] >= 3) {
    return "Scheduled early because this item is due soon and has high priority.";
  }

  if (courseworkItem.dueAt) {
    return "Scheduled before the due date using available study time.";
  }

  return "Scheduled in remaining available study time because this item has no due date.";
}

function createWarning(code, message) {
  return { code, message };
}

function calculateOverloadStatus({
  requiredMinutes,
  scheduledMinutes,
  availableMinutes,
}) {
  if (requiredMinutes === 0) {
    return "balanced";
  }

  if (availableMinutes === 0) {
    return "overloaded";
  }

  const unscheduledMinutes = Math.max(0, requiredMinutes - scheduledMinutes);
  const unscheduledRatio = unscheduledMinutes / requiredMinutes;

  if (unscheduledRatio >= 0.2) {
    return "overloaded";
  }

  if (unscheduledMinutes > 0 || scheduledMinutes / availableMinutes >= 0.8) {
    return "heavy";
  }

  return "balanced";
}

function getUnscheduledReason(courseworkItem, scheduledMinutes) {
  if (courseworkItem.dueAt && scheduledMinutes > 0) {
    return "Only part of this work fit before the due date.";
  }

  if (courseworkItem.dueAt) {
    return "Not enough availability before the due date.";
  }

  return "Not enough remaining availability in the plan range.";
}

export function buildStudyPlanSchedule({
  startDate,
  endDate,
  planningPriority,
  coursework,
  weeklyAvailability,
  availabilityExceptions,
}) {
  const availableSlots = buildAvailableSlots({
    startDate,
    endDate,
    weeklyAvailability,
    availabilityExceptions,
  });
  const availableMinutes = availableSlots.reduce(
    (total, slot) => total + getDurationMinutes(slot.startAt, slot.endAt),
    0,
  );
  const sortedCoursework = [...coursework].sort((a, b) =>
    compareCoursework(a, b, planningPriority),
  );
  const requiredMinutes = sortedCoursework.reduce(
    (total, courseworkItem) => total + courseworkItem.estimatedMinutes,
    0,
  );
  const studyBlocks = [];
  const unscheduledCoursework = [];

  for (const courseworkItem of sortedCoursework) {
    let remainingMinutes = courseworkItem.estimatedMinutes;
    let scheduledForItem = 0;
    const dueAt = courseworkItem.dueAt ? new Date(courseworkItem.dueAt) : null;

    for (const slot of availableSlots) {
      if (remainingMinutes < minimumBlockMinutes) {
        break;
      }

      if (dueAt && slot.cursor >= dueAt) {
        continue;
      }

      const allowedEndAt = dueAt && dueAt < slot.endAt ? dueAt : slot.endAt;
      let slotMinutes = getDurationMinutes(slot.cursor, allowedEndAt);

      while (
        slotMinutes >= minimumBlockMinutes &&
        remainingMinutes >= minimumBlockMinutes
      ) {
        const blockMinutes = Math.min(
          remainingMinutes,
          preferredBlockMinutes,
          slotMinutes,
        );

        if (blockMinutes < minimumBlockMinutes) {
          break;
        }

        const startAt = slot.cursor;
        const endAt = new Date(startAt.getTime() + blockMinutes * 60000);

        studyBlocks.push({
          courseworkId: courseworkItem.id,
          blockType: "study",
          startAt,
          endAt,
          explanation: getScheduleExplanation(courseworkItem),
        });

        slot.cursor = endAt;
        remainingMinutes -= blockMinutes;
        scheduledForItem += blockMinutes;
        slotMinutes = getDurationMinutes(slot.cursor, allowedEndAt);
      }
    }

    if (remainingMinutes > 0) {
      unscheduledCoursework.push({
        id: courseworkItem.id,
        title: courseworkItem.title,
        remainingMinutes,
        reason: getUnscheduledReason(courseworkItem, scheduledForItem),
      });
    }
  }

  const scheduledMinutes = studyBlocks.reduce(
    (total, studyBlock) =>
      total + getDurationMinutes(studyBlock.startAt, studyBlock.endAt),
    0,
  );
  const unscheduledMinutes = Math.max(0, requiredMinutes - scheduledMinutes);
  const overloadStatus = calculateOverloadStatus({
    requiredMinutes,
    scheduledMinutes,
    availableMinutes,
  });
  const studyDayCount = new Set(
    studyBlocks.map((studyBlock) => formatDate(studyBlock.startAt)),
  ).size;
  const warnings = [];

  if (planningPriority === "custom") {
    warnings.push(
      createWarning(
        "custom_priority_not_configured",
        "Custom planning is not configured yet, so StudyGuard used balanced scheduling rules.",
      ),
    );
  }

  if (availableMinutes === 0 && requiredMinutes > 0) {
    warnings.push(
      createWarning(
        "no_availability",
        "No available study time was found in this plan range.",
      ),
    );
  } else if (unscheduledMinutes > 0) {
    warnings.push(
      createWarning(
        "insufficient_availability",
        "Required effort is " +
          Math.ceil(requiredMinutes / 60) +
          " hours, but available study time is " +
          Math.floor(availableMinutes / 60) +
          " hours.",
      ),
    );
  }

  if (
    unscheduledCoursework.some((courseworkItem) =>
      courseworkItem.reason.includes("due date"),
    )
  ) {
    warnings.push(
      createWarning(
        "due_before_available_time",
        "Some coursework could not fit before its due date.",
      ),
    );
  }

  if (
    unscheduledCoursework.some(
      (courseworkItem) => courseworkItem.remainingMinutes > 0,
    )
  ) {
    warnings.push(
      createWarning(
        "partial_schedule",
        "Some coursework was only partially scheduled.",
      ),
    );
  }

  return {
    studyBlocks,
    summary: {
      availableMinutes,
      requiredMinutes,
      scheduledMinutes,
      unscheduledMinutes,
      studyBlockCount: studyBlocks.length,
      studyDayCount,
      overloadStatus,
    },
    unscheduledCoursework,
    warnings,
    explanations: [
      "Open coursework was sorted by due date, priority, difficulty, and grade weight.",
      "Study blocks were only placed inside available study windows.",
    ],
  };
}

export function getDefaultEndDate(startDate) {
  return addDays(startDate, 6);
}

export function getTodayDate() {
  return formatDate(new Date());
}
