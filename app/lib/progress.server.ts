import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  enrollments,
  lessonProgress,
  lessons,
  modules,
  LessonProgressStatus,
} from "~/db/schema";

function getCourseIdForLesson(lessonId: number) {
  return db
    .select({ courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .get()?.courseId;
}

function hasCompletedEveryLesson(userId: number, courseId: number) {
  const lessonIds = db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);

  if (lessonIds.length === 0) return false;

  const completed = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();

  return (completed?.count ?? 0) >= lessonIds.length;
}

function recordCourseCompletion(userId: number, courseId: number, at: string) {
  db.update(enrollments)
    .set({ completedAt: at })
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
        isNull(enrollments.completedAt)
      )
    )
    .run();
}

/**
 * Marks the lesson complete and, when it was the Student's last one, records
 * the Completed Course on their Enrollment.
 */
export function markLessonComplete(userId: number, lessonId: number) {
  const completedAt = new Date().toISOString();

  const existing = db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .get();

  const progress = existing
    ? db
        .update(lessonProgress)
        .set({ status: LessonProgressStatus.Completed, completedAt })
        .where(eq(lessonProgress.id, existing.id))
        .returning()
        .get()
    : db
        .insert(lessonProgress)
        .values({
          userId,
          lessonId,
          status: LessonProgressStatus.Completed,
          completedAt,
        })
        .returning()
        .get();

  const courseId = getCourseIdForLesson(lessonId);
  if (courseId !== undefined && hasCompletedEveryLesson(userId, courseId)) {
    recordCourseCompletion(userId, courseId, completedAt);
  }

  return progress;
}
