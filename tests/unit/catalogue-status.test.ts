import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectiveStatus } from "@/lib/catalogue-status";

// effectiveStatus() decides the status label the sales team sees on the
// catalogues list, the catalogue page and the admin search. If it is wrong,
// staff believe a stale catalogue is live (or a live one is closed).

const NOW = new Date("2026-09-01T12:00:00+05:30");
const YESTERDAY = new Date("2026-08-31T12:00:00+05:30");
const TOMORROW = new Date("2026-09-02T12:00:00+05:30");

describe("effectiveStatus", () => {
  beforeEach(() => {
    // Freeze "now" so the result never depends on the day the test runs.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps a published catalogue with no validity date as published", () => {
    expect(effectiveStatus("published", null)).toBe("published");
  });

  // BUG: fails today. The comparison in catalogue-status.ts is the wrong way round.
  it("keeps a published catalogue whose validity date is in the future as published", () => {
    expect(effectiveStatus("published", TOMORROW)).toBe("published");
  });

  // BUG: fails today, same cause.
  it("shows a published catalogue whose validity date has passed as expired", () => {
    expect(effectiveStatus("published", YESTERDAY)).toBe("expired");
  });

  it("keeps a draft as draft whatever its validity date", () => {
    expect(effectiveStatus("draft", null)).toBe("draft");
    expect(effectiveStatus("draft", YESTERDAY)).toBe("draft");
    expect(effectiveStatus("draft", TOMORROW)).toBe("draft");
  });

  it("reads the legacy 'inactive' and 'expired' database values as draft", () => {
    expect(effectiveStatus("inactive", null)).toBe("draft");
    expect(effectiveStatus("expired", null)).toBe("draft");
  });
});
