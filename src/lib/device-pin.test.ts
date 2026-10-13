import {describe,it,expect} from "vitest";
import {configureDevicePin,devicePinKey,hasDevicePin,verifyDevicePin,clearDevicePin} from "./device-pin";
function memory(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};}
describe("device PIN",()=>{
 it("stores salted hashes and unlocks only the matching PIN",async()=>{
  const storage=memory();await configureDevicePin("alice","123456",storage);
  const first=JSON.parse(storage.getItem(devicePinKey("alice"))!);
  expect(first).not.toHaveProperty("pin");expect(first.hash).toHaveLength(64);expect(first.hash).not.toBe("123456");
  expect(await verifyDevicePin("alice","654321",storage)).toMatchObject({ok:false,retryAt:0});
  expect(await verifyDevicePin("alice","123456",storage)).toMatchObject({ok:true,retryAt:0});
  await configureDevicePin("alice","123456",storage);expect(JSON.parse(storage.getItem(devicePinKey("alice"))!).salt).not.toBe(first.salt);
 },15000);
 it("blocks attempts after five failures and recovers after the cooldown",async()=>{
  const storage=memory();await configureDevicePin("alice","123456",storage);
  for(let index=0;index<5;index++)await verifyDevicePin("alice","000000",storage,1000);
  expect(await verifyDevicePin("alice","123456",storage,1001)).toMatchObject({ok:false,retryAt:61000});
  expect(await verifyDevicePin("alice","123456",storage,61000)).toMatchObject({ok:true,retryAt:0});
 },15000);
 it("rejects malformed PINs, corrupted records, and credentials copied between users",async()=>{
  const storage=memory();await expect(configureDevicePin("alice","12345x",storage)).rejects.toThrow();
  await configureDevicePin("alice","123456",storage);const record=JSON.parse(storage.getItem(devicePinKey("alice"))!);
  storage.setItem(devicePinKey("bob"),JSON.stringify({...record,userId:"bob"}));
  expect((await verifyDevicePin("bob","123456",storage)).ok).toBe(false);
  storage.setItem(devicePinKey("alice"),"broken");expect(hasDevicePin("alice",storage)).toBe(false);
  expect((await verifyDevicePin("alice","123456",storage)).ok).toBe(false);
  clearDevicePin("bob",storage);expect(hasDevicePin("bob",storage)).toBe(false);
 },15000);
});
