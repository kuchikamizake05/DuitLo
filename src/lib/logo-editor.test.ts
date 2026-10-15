import {describe,it,expect,vi,afterEach} from 'vitest';
import {defaultLogoSelection,logoSelectionSchema,buildLogoSvg,updateLogoCropPercent} from './logo-editor';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {allowLocalLogoRequest,approveLogo} from '../server/local-logo-editor';
afterEach(()=>vi.unstubAllEnvs());
describe('local SVG editor',()=>{
 it('keeps the last crop for empty or non-finite input',()=>{
  const crop={x:0,y:0,width:.35,height:1};
  for(const value of ['', ' ', '-', 'NaN', 'Infinity'])expect(updateLogoCropPercent(crop,'width',value)).toBe(crop);
 });
 it('clamps crop percentages to a valid SVG region',()=>{
  const initial=defaultLogoSelection('bca','bca');
  expect(updateLogoCropPercent(initial.crop,'width','35').width).toBe(.35);
  for(const field of ['x','y','width','height'] as const)for(const value of ['-10','0','98','100','200']){
   const crop=updateLogoCropPercent(initial.crop,field,value);
   expect(logoSelectionSchema.safeParse({...initial,crop}).success).toBe(true);
  }
 });
 it('keeps original paths and inherited fill while applying crop and background',()=>{const settings={...defaultLogoSelection('bca','bca'),background:'#ffcc00',crop:{x:0,y:0,width:.3,height:1},zoom:1.5,panX:.2};const svg=buildLogoSvg('<svg viewBox="0 0 80 26" fill="none"><path d="M0 0H20V20Z" fill="#0060AF"/></svg>',[0,0,80,26],settings);expect(svg).toContain('fill="#ffcc00"');expect(svg).toContain('width="24"');expect(svg).toContain('fill="none"');expect(svg).toContain('d="M0 0H20V20Z"');});
 it('rejects invalid crop, paths, colors, and active SVG content',()=>{const initial=defaultLogoSelection('bca','bca');for(const value of [{...initial,variant:'../secret'},{...initial,background:'url(http://bad)'},{...initial,crop:{x:.9,y:0,width:.5,height:1}}])expect(logoSelectionSchema.safeParse(value).success).toBe(false);expect(()=>buildLogoSvg('<svg><script>alert(1)</script></svg>',[0,0,80,26],initial)).toThrow();});
 it('writes only the approved export and leaves the original source unchanged',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'fintrack-logo-test-'));
  const original='<svg viewBox="0 0 80 26" fill="none"><path d="M0 0H20V20Z" fill="#0060AF"/></svg>';
  await mkdir(path.join(folder,'assets/logo-library/icons'),{recursive:true});await mkdir(path.join(folder,'src/lib'),{recursive:true});
  await writeFile(path.join(folder,'assets/logo-library/catalog.json'),JSON.stringify([{slug:'bca',name:'BCA',category:'bank-logo',viewBox:[0,0,80,26]}]));await writeFile(path.join(folder,'assets/logo-library/icons/bca.svg'),original);await writeFile(path.join(folder,'src/lib/institution-logo-overrides.json'),'{}');
  const cwd=vi.spyOn(process,'cwd').mockReturnValue(folder);
  try{const result=await approveLogo({...defaultLogoSelection('bca','bca'),background:'#dbeafe'});expect(result.src).toBe('/institutions/approved/bca.svg');expect(JSON.parse(await readFile(path.join(folder,'src/lib/institution-logo-overrides.json'),'utf8')).bca.background).toBe('#dbeafe');expect(await readFile(path.join(folder,'public/institutions/approved/bca.svg'),'utf8')).toContain('fill="#dbeafe"');expect(await readFile(path.join(folder,'assets/logo-library/icons/bca.svg'),'utf8')).toBe(original);}finally{cwd.mockRestore();if(path.resolve(folder).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(folder).startsWith('fintrack-logo-test-'))await rm(folder,{recursive:true,force:true});}
 });
 it('allows same-origin loopback writes and disables the editor in production',()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('FINTRACK_E2E','');expect(allowLocalLogoRequest(new Request('http://127.0.0.1:3000/api/local/logo-editor',{headers:{origin:'http://127.0.0.1:3000','content-type':'application/json'}}),true)).toBe(true);expect(allowLocalLogoRequest(new Request('http://127.0.0.1:3000/api/local/logo-editor',{headers:{origin:'https://example.com','content-type':'application/json'}}),true)).toBe(false);expect(allowLocalLogoRequest(new Request('http://example.com/api/local/logo-editor'))).toBe(false);vi.stubEnv('NODE_ENV','production');expect(allowLocalLogoRequest(new Request('http://127.0.0.1:3000/api/local/logo-editor'))).toBe(false);});
});
