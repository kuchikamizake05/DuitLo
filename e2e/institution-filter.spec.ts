import {test,expect} from "./fixtures";
import {mockReference} from "./reference-fixtures";

test("wallet institution selector filters by account type including search",async({page})=>{
 await mockReference(page,"light");
 await page.goto("/accounts?view=create");
 const form=page.getByRole("dialog",{name:"Tambah Rekening Baru",exact:true});
 await form.locator('[data-reference-node="tambah-akun.45"]').click();
 await form.locator('#open-sheet-btn').click();
 const picker=page.getByRole("dialog",{name:"Pilih E-Wallet",exact:true});
 await expect(picker.getByRole("button",{name:/GoPay/})).toBeVisible();
 await expect(picker.getByRole("button",{name:/Bank BCA/})).toHaveCount(0);
 await picker.getByRole("textbox").fill("BCA");
 await expect(picker.getByRole("button",{name:/Bank BCA/})).toHaveCount(0);
 await picker.getByRole("textbox").fill("");
 await picker.getByRole("button",{name:/GoPay/}).click();
 await form.locator('[data-reference-node="tambah-akun.43"]').click();
 await form.locator('#open-sheet-btn').click();
 const banks=page.getByRole("dialog",{name:"Pilih Bank",exact:true});
 await expect(banks.getByRole("button",{name:/Bank BCA/})).toBeVisible();
 await expect(banks.getByRole("button",{name:/GoPay/})).toHaveCount(0);
});
