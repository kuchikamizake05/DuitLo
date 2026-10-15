import {describe,it,expect} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createTransactionOnce,TransactionWriteConflict} from "./transaction-write";

const payload={user_id:"owner",date:"2026-10-15",type:"expense",merchant:null,category:"Food",amount:100,note:"Lunch",source:"manual",account_id:"wallet",status:"confirmed"};
function database(){
  let row:Record<string,unknown>|null=null;
  let balance=1000;
  let loseResponse=false;
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:row,error:null}),insert:async(rows:Record<string,unknown>[])=>{
    if(row)return {error:{code:"23505",message:"duplicate key"}};
    row={...rows[0]};balance-=Number(row.amount);
    return {error:loseResponse?{message:"Connection lost"}:null};
  }};
  return {client:{from:()=>query} as unknown as SupabaseClient,loseResponse:()=>{loseResponse=true;},balance:()=>balance,replace:(value:Record<string,unknown>|null)=>{row=value;}};
}
describe("idempotent transaction creation",()=>{
  it("does not debit twice when a committed response is lost and retried",async()=>{
    const db=database();db.loseResponse();
    await expect(createTransactionOnce(db.client,"stable-id",payload)).rejects.toBeTruthy();
    await createTransactionOnce(db.client,"stable-id",payload);
    expect(db.balance()).toBe(900);
  });
  it("does not mistake a different amount or owner for a successful retry",async()=>{
    const db=database();await createTransactionOnce(db.client,"stable-id",payload);
    await expect(createTransactionOnce(db.client,"stable-id",{...payload,amount:200})).rejects.toBeInstanceOf(TransactionWriteConflict);
    await expect(createTransactionOnce(db.client,"stable-id",{...payload,user_id:"other"})).rejects.toBeInstanceOf(TransactionWriteConflict);
    expect(db.balance()).toBe(900);
  });
  it("does not hide a duplicate when RLS returns no visible record",async()=>{
    const client={from:()=>({insert:async()=>({error:{code:"23505"}}),select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})})} as unknown as SupabaseClient;
    await expect(createTransactionOnce(client,"stable-id",payload)).rejects.toBeInstanceOf(TransactionWriteConflict);
  });
  it("accepts numeric database strings on a matching retry",async()=>{
    const db=database();db.replace({...payload,id:"stable-id",amount:"100.00"});
    await expect(createTransactionOnce(db.client,"stable-id",payload)).resolves.toBeUndefined();
  });
  it("propagates a failed ownership lookup instead of treating it as saved",async()=>{
    const failure={message:"Read unavailable"};
    const client={from:()=>({insert:async()=>({error:{code:"23505"}}),select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:failure})})})})})} as unknown as SupabaseClient;
    await expect(createTransactionOnce(client,"stable-id",payload)).rejects.toBe(failure);
  });
  it("rejects a returned row with the wrong transaction ID",async()=>{
    const db=database();db.replace({...payload,id:"other-id"});
    await expect(createTransactionOnce(db.client,"stable-id",payload)).rejects.toBeInstanceOf(TransactionWriteConflict);
  });
});
