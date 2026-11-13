import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { checkRefundEligibility } from "./refunds.server";

const PURCHASED_AT = "2026-03-01T10:00:00.000Z";
const A_DAY_LATER = new Date("2026-03-02T10:00:00.000Z");

describe("checkRefundEligibility", () => {
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

    lessonIds = [1, 2, 3, 4].map(
      (position) =>
        testDb
          .insert(schema.lessons)
          .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
          .returning()
          .get().id
    );
  });

  function buy(amountPaid: number, createdAt = PURCHASED_AT) {
    return testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid,
        country: "US",
        createdAt,
      })
      .returning()
      .get();
  }

  function completeLessons(count: number) {
    for (const lessonId of lessonIds.slice(0, count)) {
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId,
          status: schema.LessonProgressStatus.Completed,
        })
        .run();
    }
  }

  it("offers a Refund of what the Buyer paid inside the window", () => {
    buy(4900);

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result).toMatchObject({ eligible: true, amount: 4900 });
  });

  it("refunds the amount paid even after the course price changes", () => {
    buy(4900);
    testDb
      .update(schema.courses)
      .set({ price: 9900 })
      .where(eq(schema.courses.id, base.course.id))
      .run();

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result).toMatchObject({ eligible: true, amount: 4900 });
  });

  it("refuses once the Student has completed half of the lessons", () => {
    buy(4900);
    completeLessons(2);

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result).toMatchObject({ eligible: false, status: 403 });
  });

  it("still offers a Refund below half of the lessons", () => {
    buy(4900);
    completeLessons(1);

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result.eligible).toBe(true);
  });

  it("refuses after the last day of the window", () => {
    buy(4900);

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      new Date("2026-03-16T10:00:00.000Z")
    );

    expect(result).toMatchObject({ eligible: false, status: 403 });
  });

  it("refuses a second Refund Request on the same Purchase", () => {
    const purchase = buy(4900);
    testDb
      .insert(schema.refunds)
      .values({ purchaseId: purchase.id, reason: "Not what I expected" })
      .run();

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result).toMatchObject({ eligible: false, status: 409 });
  });

  it("looks at the latest Purchase when there are several", () => {
    buy(1000, "2026-01-01T10:00:00.000Z");
    buy(4900);

    const result = checkRefundEligibility(
      base.user.id,
      base.course.id,
      A_DAY_LATER
    );

    expect(result).toMatchObject({ eligible: true, amount: 4900 });
  });
});
