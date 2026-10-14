export const cardPalettes:Record<string,string>={red:"#491d2b,#742c40,#99465a",orange:"#4b2c20,#754633,#9c6548",yellow:"#44391e,#6d5b2c,#927a3c",green:"#173b2e,#245840,#39745a","royal-blue":"#11315b,#194b80,#2b65a0",indigo:"#292b4d,#40436d,#5a5f8c",violet:"#3c263f,#5c3c61,#7e5983",slate:"#252a34,#383f4d,#4d5668"};
export const cardColorLabels:Record<string,string>={red:"Merah",orange:"Jingga",yellow:"Kuning",green:"Hijau","royal-blue":"Biru",indigo:"Nila",violet:"Ungu",slate:"Abu-abu"};
export type AccountDisplay={cardColor:string;includeInNetWorth:boolean};
export function readAccountDisplay(userId:string,accountId:string):AccountDisplay {
  try{const value=JSON.parse(localStorage.getItem(`fintrack:account-display:${userId}:${accountId}`)??"null");const color=({forest:"green",emerald:"green",bronze:"orange"} as Record<string,string>)[value?.cardColor]??value?.cardColor;return {cardColor:color&&Object.hasOwn(cardPalettes,color)?color:"",includeInNetWorth:value?.includeInNetWorth!==false};}catch{return {cardColor:"",includeInNetWorth:true};}
}
export function saveAccountDisplay(userId:string,accountId:string,value:AccountDisplay){try{localStorage.setItem(`fintrack:account-display:${userId}:${accountId}`,JSON.stringify(value));return true;}catch{return false;}}
