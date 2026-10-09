import {describe,it,expect} from "vitest";
import {validateProfilePhoto,ownedAvatarPath,MAX_PHOTO_BYTES,getProfileCrop} from "./profile-photo";
describe("profile photo boundaries",()=>{
 it("keeps the crop square and within the image at zoom and pan extremes",()=>{expect(getProfileCrop(800,400)).toEqual({x:200,y:0,size:400});expect(getProfileCrop(800,400,2,1,-1)).toEqual({x:600,y:0,size:200});expect(getProfileCrop(400,800,4,-1,1)).toEqual({x:0,y:700,size:100});expect(()=>getProfileCrop(0,400)).toThrow();});
 it("accepts supported images and rejects oversized or unsupported files",()=>{
  for(const type of ["image/png","image/jpeg","image/webp"])expect(()=>validateProfilePhoto({type,size:123})).not.toThrow();
  for(const file of [{type:"image/svg+xml",size:123},{type:"image/png",size:0},{type:"image/png",size:MAX_PHOTO_BYTES+1}])expect(()=>validateProfilePhoto(file)).toThrow();
 });
 it("accepts only the current user's stored photo path",()=>{
  expect(ownedAvatarPath("user-one","user-one/photo.webp")).toBe("user-one/photo.webp");
  for(const value of ["user-two/photo.webp","user-one/../photo.webp","https://example.com/a.webp",null,"user-one/photo.png"])expect(ownedAvatarPath("user-one",value)).toBeNull();
 });
});
