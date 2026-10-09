import catalog from "./institutions.json";
export const institutions = catalog;
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g, "");
export function findInstitution(value:string){
  const normalized=normalize(value);
  const names=(item:typeof institutions[number])=>[item.name,item.id,...item.aliases].map(normalize);
  return institutions.find(item=>names(item).includes(normalized)) ?? institutions.find(item=>names(item).some(name=>name.length>2&&normalized.includes(name)));
}
