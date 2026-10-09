export const AVATAR_BUCKET = "profile-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export type PhotoCrop = {x:number;y:number;size:number};
export function getProfileCrop(width:number,height:number,zoom=1,panX=0,panY=0):PhotoCrop {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error("Foto belum dapat diproses. Coba lagi.");
  const size=Math.min(width,height)/Math.max(1,Math.min(4,zoom));
  return {size,x:(width-size)*(1+Math.max(-1,Math.min(1,panX)))/2,y:(height-size)*(1+Math.max(-1,Math.min(1,panY)))/2};
}
export function validateProfilePhoto(file: Pick<File, "size" | "type">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Pilih foto JPG, PNG, atau WebP.");
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error("Ukuran foto maksimal 5 MB.");
}
export function ownedAvatarPath(userId: string, value: unknown): string | null {
  return typeof value === "string" && value.startsWith(`${userId}/`) && /^[\w/-]+\.webp$/.test(value) && !value.includes("..") ? value : null;
}
export async function compressProfilePhoto(file: File, crop?:PhotoCrop): Promise<Blob> {
  validateProfilePhoto(file);
  let bitmap:ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Foto belum dapat diproses. Coba lagi."); }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto belum dapat diproses. Coba lagi.");
    const area=crop??getProfileCrop(bitmap.width,bitmap.height);
    if(![area.x,area.y,area.size].every(Number.isFinite)||area.x<0||area.y<0||area.size<=0||area.x+area.size>bitmap.width+0.001||area.y+area.size>bitmap.height+0.001)throw new Error("Foto belum dapat diproses. Coba lagi.");
    context.drawImage(bitmap, area.x, area.y, area.size, area.size, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error("Foto belum dapat diproses. Coba lagi.")), "image/webp", 0.82));
  } finally { bitmap.close(); }
}
