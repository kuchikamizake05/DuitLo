import {test,expect,mockSupabase,user} from "./fixtures";
import {mockReference} from "./reference-fixtures";

test("signing in from a shared receipt preserves the receipt destination",async({page})=>{
  await mockSupabase(page,false);
  await page.addInitScript(userId=>{
    localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused");
    localStorage.setItem(`fintrack:onboarding:v1:${userId}`,JSON.stringify({version:1,userId,step:"summary",intent:"cash-flow",accountId:null,accountName:null,transactionId:null,completedAt:"2026-10-01T00:00:00Z",deferredUntil:null}));
  },user.id);
  await page.goto("/login");
  await page.evaluate(async()=>{
    const cache=await caches.open("fintrack-shared-receipts-v2");
    await cache.put("/__shared-receipts/auth-audit/metadata",new Response(JSON.stringify({ownerId:null,createdAt:Date.now(),expiresAt:Date.now()+86400000,title:"Login receipt",text:"Receipt note",url:"",fileName:null,fileType:null}),{headers:{"Content-Type":"application/json"}}));
  });
  await page.goto("/shared-receipt?id=auth-audit");
  await expect(page).toHaveURL(/\/login\?next=%2Fshared-receipt%3Fid%3Dauth-audit$/);
  await page.getByLabel("Alamat email").fill("qa@fintrack.local");
  await page.getByLabel("Kata sandi",{exact:true}).fill("rahasia123");
  await page.getByRole("button",{name:"Masuk",exact:true}).click();
  await expect(page).toHaveURL(/\/shared-receipt\?id=auth-audit$/);
  await expect(page.getByLabel("Merchant / penerima")).toHaveValue("Login receipt");
  await page.waitForLoadState("networkidle");
});

test("a new transaction opened after midnight uses the new local date",async({page})=>{
  await mockReference(page,"light");
  await page.addInitScript(userId=>localStorage.setItem(`fintrack:menu-guide:${userId}:mode`,"paused"),user.id);
  await page.clock.setFixedTime(new Date("2026-10-15T16:59:00Z"));
  await page.goto("/transactions");
  await page.waitForLoadState("networkidle");
  await page.clock.setFixedTime(new Date("2026-10-15T17:01:00Z"));
  await page.getByRole("link",{name:"Catat Transaksi Baru",exact:true}).click();
  await page.getByRole("button",{name:"Catat manual",exact:true}).click();
  await expect(page.getByRole("dialog").locator('input[type="date"]')).toHaveValue("2026-10-16");
});

test.describe("expired session",()=>{
  test.use({allowedConsoleErrors:["the server responded with a status of 400","AuthApiError: Refresh token not found"]});
  test("a rejected refresh returns to login with the original query",async({page})=>{
    await mockReference(page,"light");
    await page.addInitScript(()=>{
      const key="sb-e2e-project-auth-token";
      const session=JSON.parse(localStorage.getItem(key)??"null");
      if(session){session.expires_at=Math.floor(Date.now()/1000)-60;localStorage.setItem(key,JSON.stringify(session));}
    });
    await page.route("**/auth/v1/token?grant_type=refresh_token",route=>route.fulfill({status:400,json:{code:"refresh_token_not_found",msg:"Refresh token not found"}}));
    await page.goto("/transactions?date=2026-10-15");
    await expect(page).toHaveURL(/\/login\?next=%2Ftransactions%3Fdate%3D2026-10-15$/);
    await expect(page.getByRole("heading",{name:"Masuk ke FinTrack"})).toBeVisible();
  });
});
