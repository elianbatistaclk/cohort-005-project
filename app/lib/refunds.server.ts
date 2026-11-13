import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  lessons,
  modules,
  purchases,
  refunds,
  videoWatchEvents,
  LessonProgressStatus,
  RefundStatus,
} from "~/db/schema";
import { getLatestPurchase } from "~/lib/purchases.server";

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COURSE_PROGRESS_LIMIT = 0.5;

type Purchase = typeof purchases.$inferSelect;

export type RefundEligibility =
  | {
      eligible: true;
      purchase: Purchase;
      amount: number;
      lastDayInWindow: string;
    }
  | { eligible: false; status: 403 | 409; reason: string };

export function getRefundRequest(purchaseId: number) {
  return db
    .select()
    .from(refunds)
    .where(
      and(
        eq(refunds.purchaseId, purchaseId),
        eq(refunds.status, RefundStatus.Requested)
      )
    )
    .get();
}

function getCourseLessonIds(courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function getCompletedLessonCount(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;

  const result = db
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

  return result?.count ?? 0;
}

function getSecondsWatched(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;

  const furthestPerLesson = db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all();

  return furthestPerLesson.reduce((total, row) => total + row.furthest, 0);
}

function hasClaimedSeat(purchaseId: number) {
  return !!db
    .select({ id: coupons.id })
    .from(coupons)
    .where(
      and(eq(coupons.purchaseId, purchaseId), isNotNull(coupons.redeemedAt))
    )
    .get();
}

// Compare whole days, not hours — a purchase at 23:00 should still get its
// full fourteenth day.
function asDayString(when: Date) {
  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Whether the Buyer may ask for a Refund of their latest Purchase of this
 * course, and how much they would get back.
 */
export function checkRefundEligibility(
  userId: number,
  courseId: number,
  now: Date = new Date()
): RefundEligibility {
  const purchase = getLatestPurchase(userId, courseId);

  if (!purchase) {
    return {
      eligible: false,
      status: 403,
      reason: "You have not bought this course.",
    };
  }

  if (getRefundRequest(purchase.id)) {
    return {
      eligible: false,
      status: 409,
      reason: "You already have a refund request open on this purchase.",
    };
  }

  if (hasClaimedSeat(purchase.id)) {
    return {
      eligible: false,
      status: 403,
      reason: "A purchase with a claimed Seat cannot be refunded.",
    };
  }

  const purchasedDay = asDayString(new Date(purchase.createdAt));
  const windowEnd = new Date(purchase.createdAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);
  const lastDayInWindow = asDayString(windowEnd);
  const today = asDayString(now);

  if (today < purchasedDay || today > lastDayInWindow) {
    return {
      eligible: false,
      status: 403,
      reason: `The ${REFUND_WINDOW_DAYS}-day refund window has closed.`,
    };
  }

  const lessonIds = getCourseLessonIds(courseId);

  if (getSecondsWatched(userId, lessonIds) >= REFUND_WATCH_LIMIT_SECONDS) {
    return {
      eligible: false,
      status: 403,
      reason: "You have watched too much of this course to get a refund.",
    };
  }

  if (
    lessonIds.length > 0 &&
    getCompletedLessonCount(userId, lessonIds) / lessonIds.length >=
      REFUND_COURSE_PROGRESS_LIMIT
  ) {
    return {
      eligible: false,
      status: 403,
      reason: "You have completed too much of this course to get a refund.",
    };
  }

  return {
    eligible: true,
    purchase,
    amount: purchase.amountPaid,
    lastDayInWindow,
  };
}
