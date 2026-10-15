import type {SupabaseClient} from "@supabase/supabase-js";

export type TransactionCreatePayload={
  user_id:string;date:string;type:string;merchant:string|null;category:string;
  amount:number;note:string|null;source:string;account_id:string;status?:string;
  receipt_url?:string|null;raw_text?:string|null;ai_confidence?:number|null;
};
export class TransactionWriteConflict extends Error {
  constructor(){super("Transaksi sebelumnya sudah tersimpan dengan data berbeda. Periksa Aktivitas sebelum mencoba lagi.");}
}

export async function createTransactionOnce(client:SupabaseClient,id:string,payload:TransactionCreatePayload) {
  const {error}=await client.from("transactions").insert([{...payload,id}]);
  if(!error)return;
  if(error.code!=="23505")throw error;
  const keys=Object.keys(payload) as Array<keyof TransactionCreatePayload>;
  const {data,error:readError}=await client.from("transactions").select("id,user_id,date,type,merchant,category,amount,note,source,account_id,status,receipt_url,raw_text,ai_confidence").eq("id",id).eq("user_id",payload.user_id).maybeSingle();
  if(readError)throw readError;
  if(!data||data.id!==id||!keys.every(key=>key==="amount"?Number(data[key])===payload[key]:data[key]===payload[key]))throw new TransactionWriteConflict();
}
