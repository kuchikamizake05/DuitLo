import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/layout.tsx", "utf8");
const script = source.match(/__html: `([^`]+)`/)![1];

describe("theme before first paint", () => {
  it.each([
    [null, null, true, true],
    [null, null, false, false],
    ["light", null, true, false],
    ["dark", "false", false, true],
    ["light", "true", true, true],
  ])("respects saved theme %s and system mode %s", (theme, system, deviceDark, expectedDark) => {
    let dark = false;
    const style = { colorScheme: "" };
    runInNewContext(script, {
      localStorage: { getItem: (key: string) => key === "fintrack-theme" ? theme : system },
      window: { matchMedia: () => ({ matches: deviceDark }) },
      document: { documentElement: { classList: { toggle: (_name: string, value: boolean) => { dark = value; } }, style } },
    });
    expect(dark).toBe(expectedDark);
    expect(style.colorScheme).toBe(expectedDark ? "dark" : "light");
  });
  it("follows the device when storage is blocked", () => {
    let dark = false;
    runInNewContext(script, {
      localStorage: { getItem: () => { throw new Error("blocked"); } },
      window: { matchMedia: () => ({ matches: true }) },
      document: { documentElement: { classList: { toggle: (_name: string, value: boolean) => { dark = value; } }, style: {} } },
    });
    expect(dark).toBe(true);
  });
});
