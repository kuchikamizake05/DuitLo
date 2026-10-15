import {describe,it,expect} from "vitest";
import {beginTransactionAttempt,finishTransactionAttempt,readTransactionAttempt} from "./transaction-attempt";
const payload={user_id:"user-a",date:"2026-10-15",type:"expense",merchant:null,category:"Food",amount:10,note:"Lunch",source:"manual",account_id:"wallet",status:"confirmed"};
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
describe("durable transaction attempts",()=>{
 it("recovers the same ID and payload after recreating the caller",()=>{
  const store=storage();const first=beginTransactionAttempt(store,"manual",payload);
  expect(readTransactionAttempt(store,"user-a","manual")).toEqual(first);
  expect(beginTransactionAttempt(store,"manual",payload).id).toBe(first.id);
  expect(readTransactionAttempt(store,"user-b","manual")).toBeNull();
 });
 it("blocks changed ambiguous drafts and only clears the matching attempt",()=>{
  const store=storage();const first=beginTransactionAttempt(store,"manual",payload);
  expect(()=>beginTransactionAttempt(store,"manual",{...payload,amount:20})).toThrow();
  finishTransactionAttempt(store,"user-a","manual","wrong-id");
  expect(readTransactionAttempt(store,"user-a","manual")).not.toBeNull();
  finishTransactionAttempt(store,"user-a","manual",first.id);
  expect(readTransactionAttempt(store,"user-a","manual")).toBeNull();
 });
 it("fails before a write when recovery storage is unavailable",()=>{
  const store=storage();store.setItem=()=>{throw new Error("storage blocked");};
  expect(()=>beginTransactionAttempt(store,"manual",payload)).toThrow();
 });
});
