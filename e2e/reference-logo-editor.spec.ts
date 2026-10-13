import {test,expect} from './fixtures';
import {mockReference} from './reference-fixtures';
for(const theme of ['light','dark'] as const)test(`local logo editor draft and approval ${theme}`,async({page},info)=>{
 await mockReference(page,theme);let approved:Record<string,unknown>|null=null;
 await page.route('**/api/local/logo-editor',async route=>{if(route.request().method()!=='POST'){const response=await route.fetch();const data=await response.json();await route.fulfill({json:{...data,overrides:{}}});return;}approved=route.request().postDataJSON();await route.fulfill({json:{selection:{...approved,src:'/institutions/approved/bca.svg',approvedAt:'2026-10-13T12:00:00Z'}}});});
 await page.goto('/design/logo-editor');await expect(page.getByRole('heading',{name:'Atur logo bank & dompet'})).toBeVisible();await expect(page.getByText('592 SVG lokal',{exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'Pratinjau Bank BCA',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Latar #dbeafe',exact:true}).click();await page.getByRole('spinbutton',{name:'Crop width',exact:true}).fill('35');await page.getByRole('slider',{name:'Zoom',exact:true}).press('ArrowRight');await page.getByRole('group',{name:'Pratinjau logo',exact:true}).press('ArrowRight');expect(approved).toBeNull();
 await page.getByRole('button',{name:'Lihat semua SVG',exact:true}).click();await page.getByRole('textbox',{name:'Cari varian SVG',exact:true}).fill('bca-mobile');await page.getByRole('button',{name:'BCA Mobile',exact:true}).click();
 await expect(page.getByRole('img',{name:'Pratinjau Bank BCA',exact:true})).toBeVisible();expect(approved).toBeNull();
 await page.screenshot({path:info.outputPath(`logo-editor-${theme}.png`),fullPage:true});
 await page.getByRole('button',{name:'Setujui & terapkan',exact:true}).click();await expect(page.getByRole('status')).toContainText('sudah disetujui');expect(approved?.['variant']).toBe('bca-mobile');expect(approved?.['background']).toBe('#dbeafe');
 await page.getByRole('button',{name:'Lanjut ke berikutnya →',exact:true}).click();await expect(page.getByRole('img',{name:'Pratinjau Bank Mandiri',exact:true})).toBeVisible();await page.waitForLoadState('networkidle');
});
test('local logo API rejects cross-origin writes and invalid settings',async({request,baseURL})=>{const foreign=await request.post('/api/local/logo-editor',{headers:{origin:'https://example.com'},data:{}});expect(foreign.status()).toBe(403);const invalid=await request.post('/api/local/logo-editor',{headers:{origin:baseURL!},data:{institution:'../../escape'}});expect(invalid.status()).toBe(400);});
