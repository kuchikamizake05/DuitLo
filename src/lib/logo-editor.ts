import {z} from "zod";
export const logoSelectionSchema=z.object({
  institution:z.string().regex(/^[a-z0-9-]+$/),variant:z.string().regex(/^[a-z0-9-]+$/),
  background:z.string().regex(/^#[a-fA-F0-9]{6}$/),zoom:z.number().min(.2).max(6),panX:z.number().min(-1).max(1),panY:z.number().min(-1).max(1),padding:z.number().min(0).max(.35),
  crop:z.object({x:z.number().min(0).max(.98),y:z.number().min(0).max(.98),width:z.number().min(.02).max(1),height:z.number().min(.02).max(1)}),
}).refine(value=>value.crop.x+value.crop.width<=1.000001&&value.crop.y+value.crop.height<=1.000001,{message:"Crop keluar dari batas SVG."});
export type LogoSelection=z.infer<typeof logoSelectionSchema>;
export function updateLogoCropPercent(crop:LogoSelection["crop"],field:keyof LogoSelection["crop"],input:string):LogoSelection["crop"] {
  if (!input.trim()) return crop;
  const percent=Number(input);
  if (!Number.isFinite(percent)) return crop;
  const next={...crop,[field]:percent/100};
  next.x=Math.max(0,Math.min(.98,next.x));
  next.y=Math.max(0,Math.min(.98,next.y));
  next.width=Math.max(.02,Math.min(1-next.x,next.width));
  next.height=Math.max(.02,Math.min(1-next.y,next.height));
  return next;
}
export type LogoVariant={slug:string;name:string;category:string;viewBox:number[];aliases?:string[]};
export const defaultLogoSelection=(institution:string,variant:string):LogoSelection=>({institution,variant,background:"#ffffff",zoom:1,panX:0,panY:0,padding:.1,crop:{x:0,y:0,width:1,height:1}});
export function buildLogoSvg(source:string,box:number[],selection:LogoSelection){
  const validated=logoSelectionSchema.parse(selection);
  if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0||/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)/i.test(source))throw new Error("SVG ini tidak didukung.");
  const opening=/<svg\b[^>]*>/i.exec(source);const end=source.lastIndexOf("</svg>");
  if(!opening||end<=opening.index)throw new Error("SVG tidak valid.");
  const content=source.slice(opening.index+opening[0].length,end);
  const inherited=[...opening[0].matchAll(/\s(fill|stroke|stroke-width|style|color|class|opacity|fill-rule|stroke-linecap|stroke-linejoin)=(["'])[^"']*\2/g)].map(match=>match[0]).join("");
  const namespaces=[...opening[0].matchAll(/\s(xmlns:[\w-]+)=(["'])[^"']*\2/g)].filter(match=>match[1]!=="xmlns:xlink").map(match=>match[0]).join("");
  const cropX=box[0]+box[2]*validated.crop.x,cropY=box[1]+box[3]*validated.crop.y,cropW=box[2]*validated.crop.width,cropH=box[3]*validated.crop.height;
  const size=512*(1-2*validated.padding)*validated.zoom;
  const left=(512-size)/2+validated.panX*256,top=(512-size)/2+validated.panY*256;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${namespaces} width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${validated.background}"/><defs><clipPath id="ft-logo-crop" clipPathUnits="userSpaceOnUse"><rect x="${cropX}" y="${cropY}" width="${cropW}" height="${cropH}"/></clipPath><clipPath id="ft-logo-frame"><rect width="512" height="512"/></clipPath></defs><g clip-path="url(#ft-logo-frame)"><svg x="${left}" y="${top}" width="${size}" height="${size}" viewBox="${cropX} ${cropY} ${cropW} ${cropH}" preserveAspectRatio="xMidYMid meet"><g clip-path="url(#ft-logo-crop)"${inherited}>${content}</g></svg></g></svg>`;
}
