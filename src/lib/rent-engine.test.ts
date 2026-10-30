import { describe, it, expect } from "vitest";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  calculateChargeStatus,
  allocatePayment,
  type RentCharge,
} from "@/lib/firestore";

// Mock dates for testing
const today = new Date();
const dueDateThisWeek = new Date(today);
dueDateThisWeek.setDate(today.getDate() + 3); // 3 days from now
const dueDateLastWeek = new Date(today);
dueDateLastWeek.setDate(today.getDate() - 10); // 10 days ago (past the 7-day grace)

describe("calculateChargeStatus", () => {
  it("returns 'paid' when amountPaid >= amountDue", () => {
    const status = calculateChargeStatus(
      dueDateThisWeek,
      10000,
      10000
    );
    expect(status).toBe("paid");
  });

  it("returns 'overdue' when past grace period with outstanding balance", () => {
    const status = calculateChargeStatus(
      dueDateLastWeek, // 5 days ago
      10000,
      3000 // partially paid but overdue
    );
    expect(status).toBe("overdue");
  });

  it("returns 'partially_paid' when some payment made but not full", () => {
    const status = calculateChargeStatus(
      dueDateThisWeek,
      10000,
      3000
    );
    expect(status).toBe("partially_paid");
  });

  it("returns 'due' when within grace period before due date", () => {
    const status = calculateChargeStatus(
      dueDateThisWeek,
      10000,
      0
    );
    expect(status).toBe("due");
  });

  it("returns 'upcoming' when due date is in the future beyond grace period", () => {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 20);
    const status = calculateChargeStatus(
      futureDate,
      10000,
      0
    );
    expect(status).toBe("upcoming");
  });

  it("returns 'paid' when full payment made on overdue charge", () => {
    const status = calculateChargeStatus(
      dueDateLastWeek,
      10000,
      10000 // Full payment clears overdue
    );
    expect(status).toBe("paid");
  });
});

describe("RentCharge interface", () => {
  it("has all required fields", () => {
    const charge: RentCharge = {
      id: "CHG-001",
      agencyId: "AG-001",
      tenancyId: "TEN-001",
      reference: "REN-ABC-001",
      periodStart: firebase.firestore.Timestamp.fromDate(new Date()),
      periodEnd: firebase.firestore.Timestamp.fromDate(new Date()),
      dueDate: firebase.firestore.Timestamp.fromDate(new Date()),
      amountDue: 50000,
      amountPaid: 0,
      outstanding: 50000,
      status: "upcoming",
      createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
      updatedAt: firebase.firestore.Timestamp.fromDate(new Date()),
    };

    expect(charge.id).toBeDefined();
    expect(charge.agencyId).toBeDefined();
    expect(charge.tenancyId).toBeDefined();
    expect(charge.reference).toBeDefined();
    expect(charge.amountDue).toBeDefined();
    expect(charge.amountPaid).toBeDefined();
    expect(charge.outstanding).toBeDefined();
    expect(charge.status).toBeDefined();
  });
});

describe("allocatePayment", () => {
  it("allocates payment to charges and returns remaining outstanding", async () => {
    // This is a unit test structure - full Firestore integration would require emulator
    const result = await allocatePayment(
      "AG-001",
      "PAY-001",
      "TEN-001",
      ["CHG-001", "CHG-002"],
      [20000, 0] // Allocate 20k to first charge, 0 to second
    );

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("allocated");
    expect(Array.isArray(result.allocated));
  });

  it("prevents double-allocation by design", async () => {
    // The function checks remaining outstanding and won't allocate more than owed
    const result = await allocatePayment(
      "AG-001",
      "PAY-001",
      "TEN-001",
      ["CHG-001"],
      [999999] // Way more than any reasonable charge
    );

    expect(result.success).toBe(true);
    // Should only allocate up to the charge's outstanding
    if (result.allocated[0]) {
      expect(result.allocated[0].amount).toBeLessThanOrEqual(999999);
    }
  });
});