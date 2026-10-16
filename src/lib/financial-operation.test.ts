import {describe,it,expect} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {beginFinancialOperation,finishFinancialOperation,readFinancialOperation,goalMetadataPayload,createTransferOnce} from "./financial-operation";

function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
const payload={goal_id:"goal",account_id:"wallet",amount:100000};
describe("durable financial operations",()=>{
 it("recovers the same request after reload and isolates owners",()=>{
  const store=storage(),first=beginFinancialOperation(store,"alice","goal-deposit",payload);
  expect(readFinancialOperation(store,"alice","goal-deposit")).toEqual(first);
  expect(beginFinancialOperation(store,"alice","goal-deposit",{amount:100000,account_id:"wallet",goal_id:"goal"}).id).toBe(first.id);
  expect(readFinancialOperation(store,"bob","goal-deposit")).toBeNull();
 });
 it("blocks changed unresolved payloads and only acknowledges matching attempts",()=>{
  const store=storage(),first=beginFinancialOperation(store,"alice","transfer",payload);
  expect(()=>beginFinancialOperation(store,"alice","transfer",{...payload,amount:200000})).toThrow();
  finishFinancialOperation(store,"alice","transfer","wrong");
  expect(readFinancialOperation(store,"alice","transfer")?.id).toBe(first.id);
  finishFinancialOperation(store,"alice","transfer",first.id);
  expect(readFinancialOperation(store,"alice","transfer")).toBeNull();
 });
 it("fails closed when recovery cannot be persisted",()=>{
  const store=storage();store.setItem=()=>{throw new Error("storage unavailable");};
  expect(()=>beginFinancialOperation(store,"alice","transfer",payload)).toThrow("storage unavailable");
 });
 it("rejects corrupt or cross-owner stored operations",()=>{
  const store=storage();beginFinancialOperation(store,"alice","transfer",payload);
  const corrupt={...store,getItem:()=>JSON.stringify({id:"request",userId:"bob",payload})};
  expect(()=>readFinancialOperation(corrupt,"alice","transfer")).toThrow();
 });
 it("metadata edits exclude a stale saved amount",()=>{
  const result=goalMetadataPayload("alice",{name:"New laptop",targetAmount:"2000000",currentAmount:"0",currency:"IDR",dueDate:""});
  expect(result).toEqual({user_id:"alice",name:"New laptop",target_amount:2000000,currency:"IDR",due_date:null});
  expect(result).not.toHaveProperty("current_amount");
 });
});

const transfer={user_id:"alice",source_account_id:"source",destination_account_id:"destination",amount:100,destination_amount:100,currency:"IDR",destination_currency:"IDR",date:"2026-10-16",kind:"transfer",note:null};
describe("transfer acknowledgement recovery",()=>{
 it("does not debit twice after a committed response is lost",async()=>{
  let row:Record<string,unknown>|null=null,balance=1000;
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:row,error:null}),insert:async(value:Record<string,unknown>)=>{
   if(row)return {error:{code:"23505"}};
   row=value;balance-=Number(value.amount);return {error:{message:"response lost"}};
  }};
  const client={from:()=>query} as unknown as SupabaseClient;
  await expect(createTransferOnce(client,"request",transfer)).rejects.toBeTruthy();
  await createTransferOnce(client,"request",transfer);
  expect(balance).toBe(900);
  await expect(createTransferOnce(client,"request",{...transfer,amount:200})).rejects.toBeTruthy();
 });
 it("does not acknowledge an invisible duplicate or failed lookup",async()=>{
  const failure={message:"lookup failed"};
  for(const error of [null,failure]){
   const query={insert:async()=>({error:{code:"23505"}}),select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error})};
   await expect(createTransferOnce({from:()=>query} as unknown as SupabaseClient,"request",transfer)).rejects.toBeTruthy();
  }
 });
});
