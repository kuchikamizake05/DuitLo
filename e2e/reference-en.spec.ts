import { fulfillPostgrestRows } from "./postgrest-response";
import {test,expect,user} from "./fixtures";
import {account,transaction,mockReference} from "./reference-fixtures";
import {writeFile} from "node:fs/promises";
for(const theme of ["light","dark"] as const)test(`English routes and forms in ${theme}`,async({page},info)=>{
 test.setTimeout(180000);await mockReference(page,theme);await page.clock.setFixedTime(new Date("2026-10-13T05:00:00Z"));
 await page.route("https://e2e-project.supabase.co/rest/v1/financial_accounts**",route=>fulfillPostgrestRows(route,[account,{...account,id:"broker",name:"Test broker",kind:"investment"}]));
 await page.route("https://e2e-project.supabase.co/rest/v1/financial_goals**",route=>fulfillPostgrestRows(route,[{id:"goal",name:"My laptop",target_amount:18000000,current_amount:7200000,currency:"IDR",due_date:"2027-01-01",is_active:true}]));
 await page.route("https://e2e-project.supabase.co/rest/v1/financial_budgets**",route=>fulfillPostgrestRows(route,[{id:"budget",category:"Transportasi",limit_amount:1000000,month:"2026-10-01"}]));
 await page.route("https://e2e-project.supabase.co/rest/v1/stock_executions**",route=>fulfillPostgrestRows(route,[{id:"execution",account_id:"broker",user_id:user.id,ticker:"BBCA",side:"buy",quantity:1000,price:8500,fee:0,currency:"IDR",executed_at:"2026-10-12T07:00:00Z"}]));
 const paths=["/dashboard","/accounts","/transactions","/insights","/planning","/goals","/investments","/settings","/reports","/trading","/journey","/design/beranda-preview","/design/mobile-dashboard","/accounts?view=create",`/accounts?view=detail&id=${account.id}`,"/accounts?view=transfer","/goals?view=create","/goals?view=detail&id=goal","/planning?view=edit&id=budget","/transactions?new=1",`/transactions?view=detail&id=${transaction.id}`,"/investments?view=create","/investments?view=detail&id=BBCA","/investments?view=edit","/investments?view=execution",`/transactions?view=detail&id=${transaction.id}&qa=edit-transaction`,`/transactions?view=detail&id=${transaction.id}&qa=delete-transaction`,"/transactions?new=1&qa=category-picker","/accounts?qa=account-picker","/investments?view=detail&id=BBCA&qa=delete-asset"];
 await page.goto("/dashboard");await page.getByRole("button",{name:"EN",exact:true}).click();
 const remaining:Record<string,string[]>={};
 const leaves:Record<string,string[]>={};
 for(const path of paths){await page.goto(path);await expect(page.locator("html")).toHaveAttribute("lang","en");await expect(page.locator("main").last()).toBeVisible();await expect(page.locator("main .ft-skeleton")).toHaveCount(0);
 if(path.includes("qa=edit-transaction"))await page.getByRole("dialog",{name:"Detail",exact:true}).getByRole("button",{name:/Edit transaction/i}).click();
 if(path.includes("qa=delete-transaction"))await page.getByRole("dialog",{name:"Detail",exact:true}).getByRole("button",{name:/Delete transaction/i}).click();
 if(path.includes("qa=category-picker"))await page.locator('[data-reference-node="catat.70"]').click();
 if(path.includes("qa=account-picker")){await page.getByRole("link",{name:"New transaction",exact:true}).click();await page.getByRole("button",{name:"Manual entry",exact:true}).click();await expect(page.locator("#nominal-input")).toBeEnabled();await page.locator('[data-reference-node="catat.54"]').click();}
 if(path.includes("qa=delete-asset"))await page.getByRole("dialog",{name:"BBCA",exact:true}).getByRole("button",{name:/Opsi lainnya|More options/}).click();

 const texts=await page.evaluate(()=>[...document.querySelectorAll("[data-reference-node],button,label,h1,h2,h3,p,input")].filter(el=>el.getClientRects().length&&el.children.length===0&&!el.classList.contains("material-symbols-outlined")).map(el=>(el instanceof HTMLInputElement?el.placeholder:el.textContent??"").trim()).filter(Boolean));
 leaves[path]=[...new Set(texts)];
 remaining[path]=[...new Set(texts)].filter(text=>/\b(?:Pilih|Simpan|Hapus|Rekening|Tanggal|Wajib|Nominal|Terkumpul|Tersisa|Terpakai|Tidak|Belum|Jumlah|Kesehatan|Pengingat|Setoran|Anggaran|Berhasil|Menghapus|Memuat|Perhitungan|Disarankan|Tercapai|Oktober|minggu ini|dari total|bulan lalu|Pencatatan|Dana|Sumber|Tujuan|Tenggat|Pagu|Saldo|Terdaftar|Rencana|Rekor|Harga|Aset|Saham|Terjadwal|Modal|Akun|Dukungan|Ketuk|Perubahan|Otomatis|Sesuai|Pastikan|Tentukan|Hubungkan|Ingatkan|Kelola|Atur|Lacak|Pantau|Tepat|Alokasi|Riwayat|Penyesuaian|Penerima|Nomor|Berbasis|terpakai|perlu|ditinjau|mencakup)\b/i.test(text)&&!text.includes("BCA Utama")&&!text.includes("Isi Bensin")&&!text.startsWith("Transportasi"));
 }
 await writeFile(`.frontend/qa-en-leaves-${theme}-${info.project.name}.json`,JSON.stringify(leaves,null,2));
 await writeFile(`.frontend/qa-en-${theme}-${info.project.name}.json`,JSON.stringify(remaining,null,2));expect(Object.values(remaining).flat()).toEqual([]);
});

test("public pages use English without an authenticated session",async({page})=>{
 await mockReference(page,"dark");await page.addInitScript(()=>{for(const key of Object.keys(localStorage))if(key.startsWith("sb-"))localStorage.removeItem(key);localStorage.setItem("fintrack-language","en");});
 for(const path of ["/login","/onboarding","/offline"]){await page.goto(path);await expect(page.locator("html")).toHaveAttribute("lang","en");await expect(page.locator("main").first()).toBeVisible();const text=await page.locator("body").innerText();expect(text).not.toMatch(/Kembali ke dashboard|Koneksi sedang terputus|Masuk ke FinTrack|Buat akun baru/);}
});
