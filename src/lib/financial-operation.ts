import type {SupabaseClient} from "@supabase/supabase-js";

type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
type Payload=Record<string,string|number|boolean|null>;
export type FinancialOperation={id:string;userId:string;scope:string;payload:Payload};
const key=(userId:string,scope:string)=>`fintrack:pending-operation:v1:${userId}:${scope}`;
const samePayload=(a:Payload,b:Payload)=>{
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 return [...keys].every(key=>a[key]===b[key]);
};
export class FinancialOperationConflict extends Error {
 constructor(){super("Masih ada proses sebelumnya yang belum terkonfirmasi. Pulihkan dan coba lagi dengan data semula sebelum membuat proses baru.");}
}
export function readFinancialOperation(store:Store,userId:string,scope:string):FinancialOperation|null {
 const raw=store.getItem(key(userId,scope));if(!raw)return null;
 const operation=JSON.parse(raw) as FinancialOperation;
 if(!operation||typeof operation.id!=="string"||!operation.id||operation.userId!==userId||operation.scope!==scope
  ||!operation.payload||Array.isArray(operation.payload)||typeof operation.payload!=="object"
  ||!Object.values(operation.payload).every(value=>value===null||typeof value==="string"||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value))))throw new Error("Draft pemulihan tidak valid.");
 return operation;
}
export function beginFinancialOperation(store:Store,userId:string,scope:string,payload:Payload):FinancialOperation {
 const existing=readFinancialOperation(store,userId,scope);
 if(existing){if(!samePayload(existing.payload,payload))throw new FinancialOperationConflict();return existing;}
 const operation={id:crypto.randomUUID(),userId,scope,payload};
 store.setItem(key(userId,scope),JSON.stringify(operation));return operation;
}
export function finishFinancialOperation(store:Store,userId:string,scope:string,id:string){
 if(readFinancialOperation(store,userId,scope)?.id===id)store.removeItem(key(userId,scope));
}
export function goalMetadataPayload(userId:string,form:{name:string;targetAmount:string;currentAmount:string;currency:string;dueDate:string}){
 return {user_id:userId,name:form.name.trim(),target_amount:Number(form.targetAmount),currency:form.currency,due_date:form.dueDate||null};
}
export function goalCreatePayload(userId:string,form:Parameters<typeof goalMetadataPayload>[1]){
 if(Number(form.currentAmount)!==0)throw new Error("Buat target dengan saldo nol, lalu setor dari rekening sumber.");
 return {...goalMetadataPayload(userId,form),current_amount:0};
}
export type TransferPayload={user_id:string;source_account_id:string;destination_account_id:string;amount:number;destination_amount:number;currency:string;destination_currency:string;date:string;kind:string;note:string|null};
export async function createTransferOnce(client:SupabaseClient,id:string,payload:TransferPayload){
 const {error}=await client.from("account_transfers").insert({...payload,id});
 if(!error)return;
 if(error.code!=="23505")throw error;
 const {data,error:readError}=await client.from("account_transfers").select("id,user_id,source_account_id,destination_account_id,amount,destination_amount,currency,destination_currency,date,kind,note").eq("id",id).eq("user_id",payload.user_id).maybeSingle();
 if(readError)throw readError;
 const keys=Object.keys(payload) as Array<keyof TransferPayload>;
 if(!data||data.id!==id||!keys.every(key=>key==="amount"||key==="destination_amount"?Number(data[key])===payload[key]:data[key]===payload[key]))throw new FinancialOperationConflict();
}
