import { describe, it, expect } from "vitest";
import { isLeapYear, formatISODate } from "../../src/lib/date";

describe("isLeapYear", () => {
  it("handles typical leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2020)).toBe(true);
  });

  it("rejects common years", () => {
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2019)).toBe(false);
  });

  it("handles century rules", () => {
    expect(isLeapYear(1900)).toBe(false); // divisible by 100 but not 400
    expect(isLeapYear(2000)).toBe(true);  // divisible by 400
  });
});

describe("formatISODate", () => {
  it("formats UTC components as YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2024, 1, 29)); // 2024-02-29
    expect(formatISODate(d)).toBe("2024-02-29");
  });

  it("throws on invalid date", () => {
    // @ts-expect-error: forcing invalid value for test
    expect(() => formatISODate(new Date("invalid"))).toThrow();
  });
});

