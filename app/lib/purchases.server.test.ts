import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { getLatestPurchase } from "./purchases.server";

describe("getLatestPurchase", () => {
  let base: ReturnType<typeof seedBaseData>;

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns the most recent of several Purchases of the same course", () => {
    // Inserted newest first, so insertion order cannot be what picks it.
    testDb
      .insert(schema.purchases)
      .values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          amountPaid: 4900,
          country: "IN",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
        {
          userId: base.user.id,
          courseId: base.course.id,
          amountPaid: 9900,
          country: "US",
          createdAt: "2026-01-01T10:00:00.000Z",
        },
      ])
      .run();

    expect(getLatestPurchase(base.user.id, base.course.id)).toMatchObject({
      country: "IN",
    });
  });
});
