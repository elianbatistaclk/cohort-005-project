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

import { claimSeat } from "./seats.server";

describe("claimSeat", () => {
  let base: ReturnType<typeof seedBaseData>;
  let teamId: number;

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    const team = testDb.insert(schema.teams).values({}).returning().get();
    teamId = team.id;

    testDb
      .insert(schema.teamMembers)
      .values({
        teamId,
        userId: base.instructor.id,
        role: schema.TeamMemberRole.Admin,
      })
      .run();

    const purchase = testDb
      .insert(schema.purchases)
      .values({
        userId: base.instructor.id,
        courseId: base.course.id,
        amountPaid: 9800,
        country: "US",
      })
      .returning()
      .get();

    testDb
      .insert(schema.coupons)
      .values({
        teamId,
        courseId: base.course.id,
        code: "SEAT-1",
        purchaseId: purchase.id,
      })
      .run();
  });

  function membersOfTeam() {
    return testDb
      .select()
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.teamId, teamId))
      .all();
  }

  it("makes the person who claims a Seat a Team Member", () => {
    const result = claimSeat("SEAT-1", base.user.id, "US");

    expect(result.ok).toBe(true);
    expect(membersOfTeam()).toContainEqual(
      expect.objectContaining({
        userId: base.user.id,
        role: schema.TeamMemberRole.Member,
      })
    );
  });

  it("does not add someone who is already a Team Member twice", () => {
    testDb
      .insert(schema.teamMembers)
      .values({
        teamId,
        userId: base.user.id,
        role: schema.TeamMemberRole.Member,
      })
      .run();

    claimSeat("SEAT-1", base.user.id, "US");

    const memberships = membersOfTeam().filter(
      (member) => member.userId === base.user.id
    );
    expect(memberships).toHaveLength(1);
  });

  it("enrolls the person who claims the Seat", () => {
    const result = claimSeat("SEAT-1", base.user.id, "US");

    expect(result).toMatchObject({
      ok: true,
      enrollment: { userId: base.user.id, courseId: base.course.id },
    });
  });

  it("refuses a Seat that was already claimed", () => {
    claimSeat("SEAT-1", base.user.id, "US");

    const second = testDb
      .insert(schema.users)
      .values({
        name: "Second",
        email: "second@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();

    expect(claimSeat("SEAT-1", second.id, "US").ok).toBe(false);
  });
});
