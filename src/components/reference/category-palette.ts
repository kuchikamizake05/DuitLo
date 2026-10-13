import type {CSSProperties} from "react";
type Tone = {lightBackground:string;lightColor:string;darkBackground:string;darkColor:string};
const tones:Record<string,Tone>={
 food:{lightBackground:"#FFEED9",lightColor:"#B45309",darkBackground:"#40351e",darkColor:"#d4a544"},
 transport:{lightBackground:"#E0F2FE",lightColor:"#0369A1",darkBackground:"#203c68",darkColor:"#aac7ff"},
 shopping:{lightBackground:"#F3E8FF",lightColor:"#7E22CE",darkBackground:"#352643",darkColor:"#c4a5ee"},
 bills:{lightBackground:"#ffedd5",lightColor:"#c2410c",darkBackground:"#422c21",darkColor:"#e8ad7f"},
 entertainment:{lightBackground:"#fce7f3",lightColor:"#be185d",darkBackground:"#412637",darkColor:"#eda6c9"},
 health:{lightBackground:"#ccfbf1",lightColor:"#0f766e",darkBackground:"#183b36",darkColor:"#80cfbf"},
 education:{lightBackground:"#f1f5f9",lightColor:"#334155",darkBackground:"#303740",darkColor:"#bdcad9"},
 income:{lightBackground:"#c5ecd2",lightColor:"#00652c",darkBackground:"#203b2d",darkColor:"#8aceaa"},
};
export function categoryTone(name:string) {
 if(/makan|kuliner|food|kafe|coffee|restoran/i.test(name))return "food";
 if(/transport|bensin|fuel|tol|parkir/i.test(name))return "transport";
 if(/belanja|shopping|supermarket/i.test(name))return "shopping";
 if(/tagih|listrik|bill|utilitas|sewa/i.test(name))return "bills";
 if(/hiburan|entertain|movie/i.test(name))return "entertainment";
 if(/sehat|health|vitamin|obat|medis/i.test(name))return "health";
 if(/pendidikan|education|sekolah|kursus/i.test(name))return "education";
 if(/gaji|salary|bonus|pendapatan|income/i.test(name))return "income";
 const names=Object.keys(tones);let hash=0;for(const char of name.toLocaleLowerCase("id-ID"))hash=(hash*31+char.charCodeAt(0))>>>0;return names[hash%names.length];
}
export function categoryAttributes(name:string,className:string) {
 const tone=tones[categoryTone(name)];
 return {"data-category-icon":name,className:`${className} ft-category-icon`,style:{"--category-bg-light":tone.lightBackground,"--category-fg-light":tone.lightColor,"--category-bg-dark":tone.darkBackground,"--category-fg-dark":tone.darkColor} as CSSProperties};
}

export function categoryColor(name:string,theme:"light"|"dark") {
 const tone=tones[categoryTone(name)];return theme==="dark"?tone.darkColor:tone.lightColor;
}
