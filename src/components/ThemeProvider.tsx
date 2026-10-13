"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
type Theme = "light" | "dark";
type ThemeContextValue = {
    theme: Theme;
    system: boolean;
    setSystem: (value:boolean) => void;
    setTheme: (theme: Theme) => void;
};
const ThemeContext = createContext<ThemeContextValue>({ theme: "light", system:false,setSystem:()=>{}, setTheme: () => { } });
function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    const color = theme === "dark" ? "#a8c4fc" : "#15803d";
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
        themeColor = document.createElement("meta");
        themeColor.name = "theme-color";
        document.head.appendChild(themeColor);
    }
    themeColor.content = color;
}
export function ThemeProvider({ children }: {
    children: ReactNode;
}) {
    const [system,setSystemState] = useState(false);
    const [theme, setThemeState] = useState<Theme>("light");
    useEffect(() => {
        let stored: Theme = "light";
        try {
            stored = localStorage.getItem("fintrack-theme") === "dark" ? "dark" : "light";
        }
        catch {
            // Theme switching remains available when browser storage is blocked.
        }
        let followsSystem=false;
        try {followsSystem=localStorage.getItem("fintrack-theme-system")==="true";}catch{}
        if(followsSystem)stored=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
        applyTheme(stored);
        const timer = window.setTimeout(() => {setThemeState(stored);setSystemState(followsSystem);}, 0);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(()=>{
      if(!system)return;
      const media=window.matchMedia("(prefers-color-scheme: dark)");
      const update=()=>{const next=media.matches?"dark":"light";applyTheme(next);setThemeState(next);};
      const timer=window.setTimeout(update,0);media.addEventListener("change",update);
      return()=>{clearTimeout(timer);media.removeEventListener("change",update);};
    },[system]);
    function setSystem(value:boolean){setSystemState(value);try{localStorage.setItem("fintrack-theme-system",String(value));}catch{}}
    function setTheme(value: Theme) {
        setSystem(false);
        setThemeState(value);
        applyTheme(value);
        try {
            localStorage.setItem("fintrack-theme", value);
        }
        catch {
            // Keep the selected theme for this session without persistence.
        }
    }
    return <ThemeContext.Provider value={{ theme, setTheme, system, setSystem }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
    return useContext(ThemeContext);
}
