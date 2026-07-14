import { describe, it, expect } from "vitest";
import {
  currentPeriod,
  refilledBalance,
  DEFAULT_MONTHLY_ALLOWANCE,
} from "../src/db/credits.js";

// These cover the pure credit policy (no DB): the monthly billing period and the
// refill rule that gives freemium accounts their allowance back each month.

describe("currentPeriod", () => {
  it("formats a date as YYYY-MM in UTC", () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
    expect(currentPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12");
  });

  it("zero-pads single-digit months", () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 8, 1)))).toBe("2026-09");
  });
});

describe("refilledBalance", () => {
  const allowance = DEFAULT_MONTHLY_ALLOWANCE;

  it("refills to the monthly allowance when the period has rolled over", () => {
    const r = refilledBalance(
      { balance: 3, monthlyAllowance: allowance, period: "2026-05" },
      "2026-06"
    );
    expect(r).toEqual({ balance: allowance, period: "2026-06", refilled: true });
  });

  it("leaves the balance untouched within the same period", () => {
    const r = refilledBalance(
      { balance: 7, monthlyAllowance: allowance, period: "2026-06" },
      "2026-06"
    );
    expect(r).toEqual({ balance: 7, period: "2026-06", refilled: false });
  });

  it("refills even when the stored balance is already at zero", () => {
    const r = refilledBalance(
      { balance: 0, monthlyAllowance: allowance, period: "2026-05" },
      "2026-06"
    );
    expect(r.balance).toBe(allowance);
    expect(r.refilled).toBe(true);
  });

  it("does not cap a balance that exceeds the allowance (e.g. after a top-up) within the period", () => {
    const r = refilledBalance(
      { balance: 320, monthlyAllowance: allowance, period: "2026-06" },
      "2026-06"
    );
    expect(r.balance).toBe(320);
    expect(r.refilled).toBe(false);
  });
});

describe("DEFAULT_MONTHLY_ALLOWANCE", () => {
  it("defaults to 20 freemium credits (1 credit = 1 page)", () => {
    expect(DEFAULT_MONTHLY_ALLOWANCE).toBe(20);
  });
});
