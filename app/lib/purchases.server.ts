import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import { purchases } from "~/db/schema";

/**
 * A User can buy the same course more than once; every rule that looks at
 * "their Purchase" of a course means the most recent one.
 */
export function getLatestPurchase(userId: number, courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(desc(purchases.createdAt), desc(purchases.id))
    .get();
}
