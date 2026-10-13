const ITERATIONS = 600_000;
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 60_000;
type PinStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PinRecord = {version:1;userId:string;salt:string;hash:string;attempts:number;retryAt:number};
export const devicePinKey = (userId:string) => `fintrack:device-pin:v1:${userId}`;
const hex = (bytes:Uint8Array) => Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
function readPin(userId:string,storage:PinStorage):PinRecord|null {
 try {
  const value=JSON.parse(storage.getItem(devicePinKey(userId))??"null");
  if(value?.version!==1||value.userId!==userId||typeof value.salt!=="string"||typeof value.hash!=="string"||! /^[a-f0-9]{32}$/.test(value.salt)||! /^[a-f0-9]{64}$/.test(value.hash)||!Number.isInteger(value.attempts)||value.attempts<0||value.attempts>MAX_ATTEMPTS||!Number.isFinite(value.retryAt)||value.retryAt<0)return null;
  return value;
 }catch{return null;}
}
async function derivePin(userId:string,pin:string,salt:string) {
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(`${userId}:${pin}`),"PBKDF2",false,["deriveBits"]);
 const bytes=Uint8Array.from(salt.match(/../g)!,part=>parseInt(part,16));
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:bytes,iterations:ITERATIONS},key,256)));
}
export function hasDevicePin(userId:string,storage?:PinStorage){try{return Boolean(readPin(userId,storage??window.localStorage));}catch{return false;}}
export function clearDevicePin(userId:string,storage?:PinStorage){try{(storage??window.localStorage).removeItem(devicePinKey(userId));}catch{}}
export async function configureDevicePin(userId:string,pin:string,storage:PinStorage=window.localStorage) {
 if(typeof pin!=="string"||typeof userId!=="string"||!/^[0-9]{6}$/.test(pin)||!userId)throw new Error("Gunakan PIN 6 digit.");
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
 const record:PinRecord={version:1,userId,salt,hash:await derivePin(userId,pin,salt),attempts:0,retryAt:0};
 storage.setItem(devicePinKey(userId),JSON.stringify(record));
}
export async function verifyDevicePin(userId:string,pin:string,storage:PinStorage=window.localStorage,now=Date.now()):Promise<{ok:boolean;retryAt:number;checkedAt:number}> {
 const record=readPin(userId,storage);
 if(!record||! /^[0-9]{6}$/.test(pin))return {ok:false,retryAt:0,checkedAt:now};
 if(record.retryAt>now)return {ok:false,retryAt:record.retryAt,checkedAt:now};
 const hash=await derivePin(userId,pin,record.salt);
 let difference=0;for(let index=0;index<hash.length;index++)difference|=hash.charCodeAt(index)^record.hash.charCodeAt(index);
 if(difference===0){storage.setItem(devicePinKey(userId),JSON.stringify({...record,attempts:0,retryAt:0}));return {ok:true,retryAt:0,checkedAt:now};}
 const attempts=(record.retryAt>0?0:record.attempts)+1;
 const retryAt=attempts>=MAX_ATTEMPTS?now+LOCK_DURATION:0;
 storage.setItem(devicePinKey(userId),JSON.stringify({...record,attempts,retryAt}));
 return {ok:false,retryAt,checkedAt:now};
}
