import type {SupabaseClient} from "@supabase/supabase-js";
export class TransactionVersionConflict extends Error {
 constructor(){super("Transaksi sudah berubah atau tidak tersedia. Muat ulang data sebelum mencoba lagi.");}
}
export async function updateTransactionVersion(client:SupabaseClient,version:{id:string;user_id:string;updated_at:string|null|undefined},patch:Record<string,unknown>){
 if(!version.updated_at)throw new TransactionVersionConflict();
 const {data,error}=await client.from("transactions").update(patch).eq("id",version.id).eq("user_id",version.user_id).eq("updated_at",version.updated_at).select("id");
 if(error)throw error;
 if(!data?.length)throw new TransactionVersionConflict();
}
