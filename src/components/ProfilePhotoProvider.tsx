"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import type {User} from "@supabase/supabase-js";
import {supabase} from "@/infrastructure/supabase/browser-client";
import {AVATAR_BUCKET,compressProfilePhoto,ownedAvatarPath,type PhotoCrop} from "@/lib/profile-photo";

const ProfilePhotoContext = createContext<{url:string|null;busy:boolean;error:string|null;upload:(file:File,crop?:PhotoCrop)=>Promise<boolean>;clearError:()=>void;remove:()=>Promise<void>}>({url:null as string|null,busy:false,error:null as string|null,upload:async()=>false,clearError:()=>{},remove:async()=>{}});
export function useProfilePhoto(){return useContext(ProfilePhotoContext);}
export function ProfilePhotoProvider({children}:{children:ReactNode}) {
  const [url,setUrl]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const locked=useRef(false);
  const identity=useRef<User|null>(null);
  const revision=useRef(0);
  useEffect(()=>{
    let live=true;
    async function refresh(user:User|null){
      identity.current=user;
      const current=++revision.current;
      const path=user?ownedAvatarPath(user.id,user.user_metadata?.profile_photo_path):null;
      if(!path){if(live)setUrl(null);return;}
      const {data,error}=await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path,7200);
      if(live&&current===revision.current)setUrl(error?null:data?.signedUrl??null);
    }
    void supabase.auth.getSession().then(({data})=>{if(live)void refresh(data.session?.user??null);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      // Storage requests run after the auth callback releases its internal lock.
      window.setTimeout(()=>{if(live)void refresh(session?.user??null);},0);
    });
    const timer=window.setInterval(()=>{if(live)void refresh(identity.current);},60*60*1000);
    return()=>{live=false;subscription.unsubscribe();window.clearInterval(timer);};
  },[]);
  async function upload(file:File,crop?:PhotoCrop){
    if(locked.current)return false;
    locked.current=true;setBusy(true);setError(null);
    let uploaded:string|null=null;
    try{
      const blob=await compressProfilePhoto(file,crop);
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Masuk kembali untuk mengganti foto profil.");
      const previous=ownedAvatarPath(user.id,user.user_metadata?.profile_photo_path);
      const path=`${user.id}/${crypto.randomUUID()}.webp`;
      const {error:uploadError}=await supabase.storage.from(AVATAR_BUCKET).upload(path,blob,{contentType:"image/webp",upsert:false});
      if(uploadError)throw new Error(/bucket not found/i.test(uploadError.message)?"Penyimpanan foto profil belum diaktifkan.":"Foto belum dapat diunggah. Coba lagi.");
      uploaded=path;
      const {error:saveError}=await supabase.auth.updateUser({data:{profile_photo_path:path}});
      if(saveError)throw new Error("Foto belum dapat disimpan. Coba lagi.");
      uploaded=null;
      const {data}=await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path,7200);
      if(identity.current?.id===user.id)setUrl(data?.signedUrl??null);
      if(previous)await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
      return true;
    }catch(caught){
      if(uploaded)await supabase.storage.from(AVATAR_BUCKET).remove([uploaded]);
      setError(caught instanceof Error?caught.message:"Foto belum dapat diunggah. Coba lagi.");
      return false;
    }finally{locked.current=false;setBusy(false);}
  }
  async function remove(){
    if(locked.current)return;
    locked.current=true;setBusy(true);setError(null);
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Masuk kembali untuk mengganti foto profil.");
      const previous=ownedAvatarPath(user.id,user.user_metadata?.profile_photo_path);
      const {error:saveError}=await supabase.auth.updateUser({data:{profile_photo_path:null}});
      if(saveError)throw new Error("Foto belum dapat disimpan. Coba lagi.");
      setUrl(null);
      if(previous)await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
    }catch(caught){setError(caught instanceof Error?caught.message:"Foto belum dapat disimpan. Coba lagi.");}
    finally{locked.current=false;setBusy(false);}
  }
  return <ProfilePhotoContext.Provider value={{url,busy,error,upload,remove,clearError:()=>setError(null)}}>{children}</ProfilePhotoContext.Provider>;
}
