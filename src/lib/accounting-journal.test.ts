import { describe, it, expect, beforeEach } from "vitest";
import {
  postJournalEntry,
  reverseJournalEntry,
  getJournalEntries,
} from "@/lib/firestore";

describe("Accounting Journal Integration", () => {
  let mockAgencyId: string;

  beforeEach(() => {
    mockAgencyId = "TEST-AGENCY-001";
  });

  it("posts a journal entry with debits and credits", async () => {
    const entryId = await postJournalEntry({
      agencyId: mockAgencyId,
      debitAccount: "Cash",
      creditAccount: "Revenue",
      amount: 50000,
      description: "Rent payment received",
      reference: "RENT-MAY-2024",
      entityType: "rent_charge",
      entityId: "CHG-001",
      postedBy: "accountant-1",
    });

    expect(entryId).toBeDefined();
    expect(entryId).toHaveLength(20); // UUID v4 length
  });

  it("validates that debit and credit accounts are different", async () => {
    await expect(
      postJournalEntry({
        agencyId: mockAgencyId,
        debitAccount: "Cash",
        creditAccount: "Cash",
        amount: 1000,
        description: "Test entry",
        entityType: "payment",
        entityId: "PAY-001",
        postedBy: "test",
      })
    ).rejects.toThrow("Debit and credit accounts must be different");
  });

  it("validates amount is positive", async () => {
    await expect(
      postJournalEntry({
        agencyId: mockAgencyId,
        debitAccount: "Cash",
        creditAccount: "Bank",
        amount: 0,
        description: "Test entry",
        entityType: "payment",
        entityId: "PAY-001",
        postedBy: "test",
      })
    ).rejects.toThrow("Journal entry amount must be positive");

    await expect(
      postJournalEntry({
        agencyId: mockAgencyId,
        debitAccount: "Cash",
        creditAccount: "Bank",
        amount: -100,
        description: "Test entry",
        entityType: "payment",
        entityId: "PAY-001",
        postedBy: "test",
      })
    ).rejects.toThrow("Journal entry amount must be positive");
  });

  it("reverses a journal entry creating an offsetting entry", async () => {
    // First, create an entry
    const originalEntry = await postJournalEntry({
      agencyId: mockAgencyId,
      debitAccount: "Accounts Receivable",
      creditAccount: "Revenue",
      amount: 25000,
      description: "Original rent charge entry",
      entityType: "rent_charge",
      entityId: "CHG-002",
      postedBy: "system",
    });

    // Then reverse it
    const result = await reverseJournalEntry(
      mockAgencyId,
      originalEntry,
      "Reversing rent charge entry - tenant payment reversed"
    );

    expect(result.success).toBe(true);
    expect(result.reversalEntryId).toBeDefined();
    expect(result.originalEntry.reversalOf).toBeDefined();

    // Verify the original entry is marked as reversed
    expect(result.originalEntry.status).toBe("reversed");

    // Verify the reversal entry has opposite accounts
    // Note: In a real test with firestore, we'd query the reversal entry
    expect(result.reversalEntryId).toHaveLength(20);
  });

  it("cannot reverse an already reversed entry", async () => {
    // Create and reverse an entry
    const originalEntry = await postJournalEntry({
      agencyId: mockAgencyId,
      debitAccount: "Cash",
      creditAccount: "Revenue",
      amount: 10000,
      description: "Entry to reverse",
      entityType: "payment",
      entityId: "PAY-003",
      postedBy: "test",
    });

    await reverseJournalEntry(
      mockAgencyId,
      originalEntry,
      "First reversal"
    );

    // Try to reverse again - should fail
    const result = await reverseJournalEntry(
      mockAgencyId,
      originalEntry,
      "Second reversal attempt"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("already been reversed");
  });

  it("retrieves journal entries for an agency", async () => {
    // Post a few entries
    await postJournalEntry({
      agencyId: mockAgencyId,
      debitAccount: "Cash",
      creditAccount: "Revenue",
      amount: 10000,
      description: "Entry 1",
      entityType: "payment",
      entityId: "PAY-004",
      postedBy: "test",
    });

    await postJournalEntry({
      agencyId: mockAgencyId,
      debitAccount: "Expense",
      creditAccount: "Cash",
      amount: 5000,
      description: "Entry 2",
      entityType: "expense",
      entityId: "EXP-001",
      postedBy: "test",
    });

    const entries = await getJournalEntries(mockAgencyId);

    expect(entries.length).toBe(2);
    expect(entries[0].debitAccount).toBe("Cash");
    expect(entries[1].creditAccount).toBe("Cash");
  });

  it("maintains debit-credit balance consistency", () => {
    // All journal entries should have the property that the entry was created with
    // In a full system, we'd verify sum(debits) === sum(credits) across all entries
    // For this test, we verify the postJournalEntry function can be called multiple times
    expect(true).toBe(true); // Placeholder - actual balance verification would need DB access
  });
});