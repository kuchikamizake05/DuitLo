import { fulfillPostgrestRows } from "./postgrest-response";
import type {Page} from "@playwright/test";
import {mockAuthenticatedSession,user} from "./fixtures";
export const account={id:"account-reference",user_id:user.id,name:"BCA Utama",institution:"Bank BCA",kind:"bank",currency:"IDR",current_balance:14500000,reporting_balance_idr:null,is_active:true,created_at:"2026-01-01T00:00:00Z"};
export const transaction={id:"transaction-reference",user_id:user.id,date:"2026-10-12",type:"expense",merchant:"Isi Bensin Pertamax",category:"Transportasi",amount:250000,note:"Operasional kerja",account_id:account.id,status:"confirmed",source:"manual",receipt_url:null,created_at:"2026-10-12T07:00:00Z",updated_at:"2026-10-12T07:00:00Z"};
export async function mockReference(page:Page,theme:"light"|"dark"){
 await mockAuthenticatedSession(page);await page.addInitScript(theme=>{localStorage.setItem("fintrack-theme",theme);},theme);
 await page.route("https://e2e-project.supabase.co/**",async route=>{const path=new URL(route.request().url()).pathname;if(path==="/auth/v1/user"){await route.fulfill({json:user});return;}const data=path.endsWith("financial_accounts")?[account]:path.endsWith("transactions")?[transaction]:path.endsWith("categories")?[{name:"Transportasi",type:"expense"},{name:"Gaji",type:"income"}]:[];await fulfillPostgrestRows(route,data);});
 await page.route("**/api/insights/generate",route=>route.fulfill({status:200,json:{insight:{headline:"Ringkasan",summary:"Ringkasan",tone:"neutral",actions:[],observations:[],generatedAt:"2026-10-12T00:00:00Z"}}}));
}
