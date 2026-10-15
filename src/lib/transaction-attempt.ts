import {TransactionWriteConflict,type TransactionCreatePayload} from "./transaction-write";
type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
type Attempt={id:string;payload:TransactionCreatePayload};
const key=(userId:string,scope:string)=>`fintrack:pending-save:v1:${userId}:${scope}`;
export function readTransactionAttempt(store:Store,userId:string,scope:string):Attempt|null {
  const raw=store.getItem(key(userId,scope));
  if(!raw)return null;
  const parsed=JSON.parse(raw) as Attempt;
  const p=parsed?.payload;
  if(!parsed||typeof parsed.id!=="string"||!p||p.user_id!==userId
    ||![p.date,p.category,p.source,p.account_id].every(value=>typeof value==="string")
    ||!["income","expense"].includes(p.type)||!Number.isFinite(p.amount)||p.amount<=0
    ||![p.merchant,p.note].every(value=>value===null||typeof value==="string"))throw new Error("Draft pemulihan tidak valid.");
  return parsed;
}
export function beginTransactionAttempt(store:Store,scope:string,payload:TransactionCreatePayload):Attempt {
  const existing=readTransactionAttempt(store,payload.user_id,scope);
  if(existing){
    const keys=new Set([...Object.keys(existing.payload),...Object.keys(payload)]);
    if(![...keys].every(key=>existing.payload[key as keyof TransactionCreatePayload]===payload[key as keyof TransactionCreatePayload]))throw new TransactionWriteConflict();
    return existing;
  }
  const attempt={id:crypto.randomUUID(),payload};
  store.setItem(key(payload.user_id,scope),JSON.stringify(attempt));
  return attempt;
}
export function finishTransactionAttempt(store:Store,userId:string,scope:string,id:string){
  if(readTransactionAttempt(store,userId,scope)?.id===id)store.removeItem(key(userId,scope));
}
