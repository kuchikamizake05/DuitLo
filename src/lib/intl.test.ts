import {describe,expect,it} from "vitest";
import {getNumberFormatter} from "./intl";

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
