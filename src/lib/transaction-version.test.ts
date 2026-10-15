import {describe,it,expect} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {updateTransactionVersion,TransactionVersionConflict} from "./transaction-version";
describe("transaction version checks",()=>{
 function database(){
  const row={id:"tx",user_id:"owner",updated_at:"v1",amount:100,status:"confirmed"};
  const client={from:()=>({update:(patch:Record<string,unknown>)=>{
   const filters:Record<string,unknown>={};const query={eq:(key:string,value:unknown)=>{filters[key]=value;return query;},select:async()=>{
    if(!Object.entries(filters).every(([key,value])=>row[key as keyof typeof row]===value))return {data:[],error:null};
    Object.assign(row,patch,{updated_at:"v2"});return {data:[{id:row.id}],error:null};
   }};return query;
  }})} as unknown as SupabaseClient;
  return {client,row};
 }
 it("allows one edit and rejects a stale edit or delete",async()=>{
  const {client,row}=database();
  await updateTransactionVersion(client,{id:"tx",user_id:"owner",updated_at:"v1"},{amount:200});
  await expect(updateTransactionVersion(client,{id:"tx",user_id:"owner",updated_at:"v1"},{amount:300})).rejects.toBeInstanceOf(TransactionVersionConflict);
  await expect(updateTransactionVersion(client,{id:"tx",user_id:"owner",updated_at:"v1"},{status:"deleted"})).rejects.toBeInstanceOf(TransactionVersionConflict);
  expect(row.amount).toBe(200);expect(row.status).toBe("confirmed");
 });
 it("rejects ownership mismatch or a missing version",async()=>{
  const {client}=database();
  await expect(updateTransactionVersion(client,{id:"tx",user_id:"other",updated_at:"v1"},{amount:200})).rejects.toBeInstanceOf(TransactionVersionConflict);
  await expect(updateTransactionVersion(client,{id:"tx",user_id:"owner",updated_at:null},{amount:200})).rejects.toBeInstanceOf(TransactionVersionConflict);
 });
 it("preserves network errors rather than claiming a conflict",async()=>{
  const error={message:"offline"};const query={eq:()=>query,select:async()=>({data:null,error})};
  const client={from:()=>({update:()=>query})} as unknown as SupabaseClient;
  await expect(updateTransactionVersion(client,{id:"tx",user_id:"owner",updated_at:"v1"},{amount:200})).rejects.toBe(error);
 });
});
