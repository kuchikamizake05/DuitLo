import {describe,it,expect} from "vitest";
import {summarizeTrackedAssets} from "./financial-assets";
const account={id:"wallet",kind:"bank",currency:"IDR",current_balance:1000000,reporting_balance_idr:null,is_active:true};
describe("wallet and reserved goal asset totals",()=>{
 it("preserves total assets when money moves from wallet into a goal",()=>{
  const before=summarizeTrackedAssets([account],[]);
  const after=summarizeTrackedAssets([{...account,current_balance:900000}],[{id:"goal",currency:"IDR",current_amount:100000,is_active:true}]);
  expect(before.totalTrackedIdr).toBe(1000000);
  expect(after).toMatchObject({walletFundsIdr:900000,reservedGoalsIdr:100000,totalTrackedIdr:1000000});
 });
 it("retains reserved funds in archived goals and excludes liabilities or opted-out wallets",()=>{
  expect(summarizeTrackedAssets([account,{...account,id:"debt",kind:"liability",current_balance:500000},{...account,id:"excluded",includeInNetWorth:false}], [{id:"archived",currency:"IDR",current_amount:100000,is_active:false}])).toMatchObject({walletFundsIdr:1000000,reservedGoalsIdr:100000,totalTrackedIdr:1100000});
 });
 it("never treats unknown foreign savings as zero or adds unlike currencies",()=>{
  expect(summarizeTrackedAssets([account],[{id:"usd",currency:"USD",current_amount:100,is_active:false}])).toMatchObject({walletFundsIdr:1000000,reservedGoalsIdr:null,totalTrackedIdr:null,reservedByCurrency:{USD:100},missingCurrencies:["USD"]});
 });
 it("uses supplied conversion rates and existing wallet reporting values",()=>{
  expect(summarizeTrackedAssets([{...account,currency:"USD",current_balance:100,reporting_balance_idr:1600000}],[{id:"usd",currency:"USD",current_amount:50,is_active:true}],new Map([["USD",16000]]))).toMatchObject({walletFundsIdr:1600000,reservedGoalsIdr:800000,totalTrackedIdr:2400000});
 });
 it("ignores zero foreign goal balances but does not publish invalid monetary totals",()=>{
  expect(summarizeTrackedAssets([account],[{id:"empty",currency:"USD",current_amount:0,is_active:false}]).totalTrackedIdr).toBe(1000000);
  expect(summarizeTrackedAssets([{...account,current_balance:NaN}],[]).totalTrackedIdr).toBeNull();
  expect(summarizeTrackedAssets([{...account,current_balance:1e308},{...account,id:"large",current_balance:1e308}],[]).totalTrackedIdr).toBeNull();
 });
});
