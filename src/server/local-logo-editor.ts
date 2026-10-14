import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import path from "node:path";
import {institutions} from "../lib/institutions";
import {buildLogoSvg,logoSelectionSchema,type LogoVariant,type LogoSelection} from "../lib/logo-editor";
export function localLogoEditorEnabled(){return process.env.NODE_ENV==="development"||process.env.FINTRACK_E2E==="1";}
export function allowLocalLogoRequest(request:Request,mutation=false){
  const url=new URL(request.url);
  const host=request.headers.get("host");
  if(host)url.host=host;
  return localLogoEditorEnabled()&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&(!mutation||(request.headers.get("origin")===url.origin&&request.headers.get("content-type")?.split(";")[0]==="application/json"));
}
const library=()=>path.join(process.cwd(),"assets","logo-library");
const overridesPath=()=>path.join(process.cwd(),"src","lib","institution-logo-overrides.json");
export type LogoOverrides=Record<string,LogoSelection&{src:string;approvedAt:string}>;
export async function readLogoLibrary():Promise<LogoVariant[]>{return JSON.parse(await readFile(path.join(library(),"catalog.json"),"utf8"));}
export async function readLogoOverrides():Promise<LogoOverrides>{return JSON.parse(await readFile(overridesPath(),"utf8"));}
export async function readLogoSource(slug:string){
  const variants=await readLogoLibrary();const variant=variants.find(item=>item.slug===slug);
  if(!variant||!/^[a-z0-9-]+$/.test(slug))throw new Error("Varian SVG tidak ditemukan.");
  const source=await readFile(path.join(library(),"icons",`${slug}.svg`),"utf8");
  return {variant,source};
}
let pending=Promise.resolve();
export async function approveLogo(raw:unknown){
  const selection=logoSelectionSchema.parse(raw);
  if(!institutions.some(item=>item.id===selection.institution))throw new Error("Institusi tidak valid.");
  const {variant,source}=await readLogoSource(selection.variant);
  const svg=buildLogoSvg(source,variant.viewBox,selection);
  const commit=pending.then(async()=>{
    const overrides=await readLogoOverrides();const dir=path.join(process.cwd(),"public","institutions","approved");await mkdir(dir,{recursive:true});
    const output=path.join(dir,`${selection.institution}.svg`);await writeFile(`${output}.tmp`,svg);await rename(`${output}.tmp`,output);
    const approved={...selection,src:`/institutions/approved/${selection.institution}.svg`,approvedAt:new Date().toISOString()};
    overrides[selection.institution]=approved;await writeFile(`${overridesPath()}.tmp`,JSON.stringify(overrides,null,2)+"\n");await rename(`${overridesPath()}.tmp`,overridesPath());
    return approved;
  });
  pending=commit.then(()=>{},()=>{});return commit;
}
