import {describe,expect,it} from "vitest";
import {getNumberFormatter, getDateFormatter} from "./intl";

describe("cached date formatter", () => {
  it("preserves timezone and language around a date boundary", () => {
    const date = new Date("2026-10-14T18:00:00Z");
    for (const locale of ["id-ID", "en-GB"]) {
      for (const timeZone of ["Asia/Jakarta", "UTC"]) {
        const options = { weekday: "short", day: "numeric", month: "short", timeZone } as const;
        expect(getDateFormatter(locale, options).format(date)).toBe(new Intl.DateTimeFormat(locale, options).format(date));
      }
    }
  });
  it("reuses matching configurations and separates timezones", () => {
    expect(getDateFormatter("id-ID", { timeZone: "UTC" })).toBe(getDateFormatter("id-ID", { timeZone: "UTC" }));
    expect(getDateFormatter("id-ID", { timeZone: "UTC" })).not.toBe(getDateFormatter("id-ID", { timeZone: "Asia/Jakarta" }));
  });
  it("keeps formatting correctly after the bounded cache fills", () => {
    for (const locale of ["id-ID", "en-GB", "en-US", "fr-FR", "de-DE"]) {
      for (const timeZone of ["UTC", "Asia/Jakarta", "Asia/Tokyo", "America/New_York", "Europe/London"]) {
        for (const weekday of ["short", "long"] as const) {
          for (const month of ["short", "long", "numeric"] as const) getDateFormatter(locale, { timeZone, weekday, month });
        }
      }
    }
    expect(getDateFormatter("id-ID", { timeZone: "Asia/Jakarta", day: "numeric" }).format(new Date("2026-10-14T18:00:00Z"))).toBe("15");
  });
});

describe("cached number formatter",()=>{
  it("preserves locale, currency, and precision",()=>{
    for (const locale of ["id-ID","en-ID"]) for(const currency of ["IDR","USD"]){
      const options={style:"currency",currency,maximumFractionDigits:currency==="IDR"?0:2} as const;
      expect(getNumberFormatter(locale,options).format(12345.67)).toBe(new Intl.NumberFormat(locale,options).format(12345.67));
    }
  });
  it("reuses only matching formatter configurations",()=>{
    expect(getNumberFormatter("id-ID")).toBe(getNumberFormatter("id-ID"));
    expect(getNumberFormatter("en-US")).not.toBe(getNumberFormatter("id-ID"));
    expect(getNumberFormatter("id-ID",{maximumFractionDigits:0})).not.toBe(getNumberFormatter("id-ID",{maximumFractionDigits:2}));
  });
  it("bounds cache growth while retaining formatter behavior",()=>{
    for(let i=1;i<=140;i++)getNumberFormatter("id-ID",{minimumIntegerDigits:i%21+1,maximumFractionDigits:Math.floor(i/21)});
    expect(getNumberFormatter("id-ID").format(1234)).toBe("1.234");
  });
});
