import { fulfillPostgrestRows } from "./postgrest-response";
import {test,expect,user} from "./fixtures";
import {mockReference,account} from "./reference-fixtures";

test.use({allowedConsoleErrors:["the server responded with a status of 503","the server responded with a status of 409"]});
test("offline create survives a committed response failure and reconnects once",async({page,context})=>{
 await mockReference(page,"light");
 await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
 const id="19fc584a-3262-4889-8383-d5526e700d11";
 const payload={id,date:"2026-10-15",type:"expense",merchant:null,category:"Transportasi",amount:100,note:"Offline retry",account_id:account.id,source:"manual"};
 let row:Record<string,unknown>|null=null;let inserts=0;
 await page.route("**/rest/v1/transactions**",async route=>{
  if(route.request().method()==="POST"){
   inserts++;const raw=route.request().postDataJSON();
   if(row){await route.fulfill({status:409,json:{code:"23505",message:"duplicate key"}});return;}
   row={...(Array.isArray(raw)?raw[0]:raw),status:"confirmed",created_at:"2026-10-15T08:00:00Z",updated_at:"2026-10-15T08:00:00Z"};
   await route.fulfill({status:503,json:{message:"Response lost"}});return;
  }
  await fulfillPostgrestRows(route,row?[row]:[]);
 });
 await page.goto("/transactions");await page.waitForLoadState("networkidle");
 await context.setOffline(true);
 await page.evaluate(async({id,payload,userId})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("fintrack-offline-v1",1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore("transaction-operations",{keyPath:"opId"});store.createIndex("userId","userId");store.createIndex("createdAt","createdAt");};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction("transaction-operations","readwrite");tx.objectStore("transaction-operations").put({opId:"offline-audit",userId,kind:"create",transactionId:id,payload,baseUpdatedAt:null,createdAt:new Date().toISOString(),attempts:0,state:"pending",lastError:null});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 },{id,payload,userId:user.id});
 await context.setOffline(false);
 await expect.poll(()=>inserts).toBe(1);
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("fintrack-offline-v1",1);request.onsuccess=()=>resolve(request.result);});
  return new Promise<number>(resolve=>{const tx=db.transaction("transaction-operations","readonly");const request=tx.objectStore("transaction-operations").get("offline-audit");request.onsuccess=()=>{resolve(request.result?.attempts??0);db.close();};});
 })).toBe(1);
 await context.setOffline(true);
 await page.evaluate(()=>window.dispatchEvent(new Event("offline")));
 await context.setOffline(false);
 await page.evaluate(()=>window.dispatchEvent(new Event("online")));
 await expect.poll(()=>inserts).toBe(2);
 expect(row).toMatchObject({id});
 await expect.poll(()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("fintrack-offline-v1",1);request.onsuccess=()=>resolve(request.result);});
  return new Promise<number>(resolve=>{const tx=db.transaction("transaction-operations","readonly");const request=tx.objectStore("transaction-operations").count();request.onsuccess=()=>{resolve(request.result);db.close();};});
 })).toBe(0);
});
