import {test,expect} from '@playwright/test';
import {mockReference,account} from './reference-fixtures';

test('transfer retry after a committed but lost response retains operation identity',async({page})=>{
 await mockReference(page,'light');
 const other={...account,id:'other-account',name:'Mandiri',institution:'Bank Mandiri'};
 await page.route('**/rest/v1/financial_accounts**',route=>route.fulfill({json:[account,other]}));
 const writes:Record<string,unknown>[]=[];
 const committed=new Set<string>();let balance=1000000;
 await page.route('**/rest/v1/account_transfers**',async route=>{
  if(route.request().method()==='POST'){
   writes.push(route.request().postDataJSON());
   const id=String(writes.at(-1)?.id??`server-${writes.length}`);
   if(!committed.has(id)){committed.add(id);balance-=Number(writes.at(-1)?.amount);}
   await route.fulfill(writes.length===1?{status:500,json:{message:'Simulated gateway failure after commit'}}:{status:201,json:[]});
  }else await route.fulfill({json:[]});
 });
 await page.goto('/accounts?view=transfer');
 await page.getByText('Pilih rekening sumber',{exact:true}).click();
 await page.getByRole('dialog',{name:'Pilih Rekening',exact:true}).getByRole('button',{name:/BCA Utama/}).click();
 await page.getByRole('dialog',{name:'Pilih Rekening',exact:true}).getByRole('button',{name:'Gunakan',exact:true}).click();
 await page.getByText('Pilih rekening tujuan',{exact:true}).click();
 await page.getByRole('dialog',{name:'Pilih Rekening',exact:true}).getByRole('button',{name:/Mandiri/}).click();
 await page.getByRole('dialog',{name:'Pilih Rekening',exact:true}).getByRole('button',{name:'Gunakan',exact:true}).click();
 await page.locator('#transferAmount').fill('100000');
 await page.locator('#confirmTransferBtn').click();
 await expect(page.getByText('Transfer belum berhasil disimpan. Coba lagi.',{exact:true})).toBeVisible();
 await page.locator('#confirmTransferBtn').click();
 await expect.poll(()=>writes.length).toBe(2);
 expect(writes[0].id).toBeTruthy(); expect(writes[1].id).toBe(writes[0].id);
 expect(balance).toBe(900000);
});

test('goal deposit retry after reload reuses committed request identity',async({page})=>{
 await mockReference(page,'light');
 let balance=1000000;
 const goal={id:'audit-goal',name:'Audit goal',target_amount:2000000,current_amount:0,currency:'IDR',color:null,due_date:null,is_active:true};
 await page.route('**/rest/v1/financial_accounts**',route=>route.fulfill({json:[{...account,current_balance:balance}]}));
 await page.route('**/rest/v1/financial_goals**',route=>route.fulfill({json:[goal]}));
 const ids:string[]=[];
 let attempts=0;
 await page.route('**/rest/v1/rpc/deposit_to_financial_goal',async route=>{
  const payload=route.request().postDataJSON();
  attempts++;
  if(!ids.includes(payload.p_request_id)){ids.push(payload.p_request_id);balance-=payload.p_amount;goal.current_amount+=payload.p_amount;}
  await route.fulfill(attempts===1?{status:500,json:{message:'Simulated gateway failure after commit'}}:{json:goal});
 });
 async function submit(){
  await page.locator('#nominal-input').fill('100000');
  await page.getByRole('combobox',{name:'Rekening Sumber Dana',exact:true}).selectOption(account.id);
  await page.getByRole('button',{name:'Konfirmasi Setoran',exact:true}).click();
 }
 await page.goto('/goals?view=detail&id=audit-goal');
 await submit();
 await expect(page.getByRole('alert').first()).toContainText('Setoran belum tersimpan');
 await page.reload();
 await submit();
 await expect.poll(()=>attempts).toBe(2);
 await expect.poll(()=>ids.length).toBe(1);
 expect(balance).toBe(900000);
});

test('stale goal metadata draft never writes the saved balance',async({page})=>{
 await mockReference(page,'light');
 const goal={id:'audit-goal',name:'Audit goal',target_amount:2000000,current_amount:0,currency:'IDR',color:null,due_date:null,is_active:true};
 const updates:Record<string,unknown>[]=[];
 await page.route('**/rest/v1/financial_goals**',async route=>{
  if(route.request().method()==='PATCH'){updates.push(route.request().postDataJSON());await route.fulfill({status:204});}
  else await route.fulfill({json:[goal]});
 });
 await page.goto('/goals?view=detail&id=audit-goal');
 await page.getByRole('button',{name:'Ubah Rencana',exact:true}).click();
 // A deposit in a second tab happens while this metadata draft is open.
 goal.current_amount=100000;
 await page.locator('#goalName').fill('Updated goal');
 await page.locator('#btnSubmit').click();
 await expect.poll(()=>updates.length).toBe(1);
 expect(updates[0]).not.toHaveProperty('current_amount');
 expect(goal.current_amount).toBe(100000);
});


