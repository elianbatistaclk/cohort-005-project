import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  enrollments,
  purchases,
  teamMembers,
  TeamMemberRole,
} from "~/db/schema";

export function getSeatByCode(code: string) {
  return db.select().from(coupons).where(eq(coupons.code, code)).get();
}

type ClaimResult =
  | { ok: true; enrollment: typeof enrollments.$inferSelect }
  | { ok: false; error: string };

function isTeamMember(userId: number, teamId: number) {
  return !!db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
    .get();
}

/**
 * Gives the Seat behind this Seat Code to the User: they get an Enrollment in
 * the course and join the Team that bought it.
 */
export function claimSeat(
  code: string,
  userId: number,
  userCountry: string
): ClaimResult {
  const seat = getSeatByCode(code);
  if (!seat) {
    return { ok: false, error: "Seat Code not found" };
  }

  if (seat.redeemedByUserId !== null) {
    return { ok: false, error: "This Seat has already been claimed" };
  }

  const existingEnrollment = db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, seat.courseId)
      )
    )
    .get();

  if (existingEnrollment) {
    return { ok: false, error: "You are already enrolled in this course" };
  }

  const purchase = db
    .select()
    .from(purchases)
    .where(eq(purchases.id, seat.purchaseId))
    .get();

  if (purchase?.country && purchase.country !== userCountry) {
    return {
      ok: false,
      error:
        "This Seat can only be claimed from the same country as the Buyer",
    };
  }

  const claimedAt = new Date().toISOString();

  return db.transaction((tx): ClaimResult => {
    tx.update(coupons)
      .set({ redeemedByUserId: userId, redeemedAt: claimedAt })
      .where(eq(coupons.id, seat.id))
      .run();

    if (!isTeamMember(userId, seat.teamId)) {
      tx.insert(teamMembers)
        .values({
          teamId: seat.teamId,
          userId,
          role: TeamMemberRole.Member,
        })
        .run();
    }

    const enrollment = tx
      .insert(enrollments)
      .values({ userId, courseId: seat.courseId })
      .returning()
      .get();

    return { ok: true, enrollment };
  });
}
