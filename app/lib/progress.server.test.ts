import { describe, it, expect, vi, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { markLessonComplete } from "./progress.server";

describe("markLessonComplete", () => {
  let base: ReturnType<typeof seedBaseData>;
  let lessonIds: number[];

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    const mod = testDb
      .insert(schema.modules)
      .values({ courseId: base.course.id, title: "Module 1", position: 1 })
      .returning()
      .get();

    lessonIds = [1, 2].map(
      (position) =>
        testDb
          .insert(schema.lessons)
          .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
          .returning()
          .get().id
    );

    testDb
      .insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();
  });

  function getEnrollment() {
    return testDb
      .select()
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.userId, base.user.id),
          eq(schema.enrollments.courseId, base.course.id)
        )
      )
      .get();
  }

  it("does not complete the course while a lesson is still pending", () => {
    markLessonComplete(base.user.id, lessonIds[0]);

    expect(getEnrollment()?.completedAt).toBeNull();
  });

  it("records the Completed Course when the last lesson is completed", () => {
    markLessonComplete(base.user.id, lessonIds[0]);
    markLessonComplete(base.user.id, lessonIds[1]);

    expect(getEnrollment()?.completedAt).not.toBeNull();
  });

  it("keeps the first completion date when a lesson is completed again", () => {
    markLessonComplete(base.user.id, lessonIds[0]);
    markLessonComplete(base.user.id, lessonIds[1]);
    const firstCompletion = getEnrollment()?.completedAt;

    markLessonComplete(base.user.id, lessonIds[0]);

    expect(getEnrollment()?.completedAt).toBe(firstCompletion);
  });
});
