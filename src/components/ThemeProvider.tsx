"use client";
import { createContext, useCallback, useMemo, useContext, useEffect, useState, type ReactNode } from "react";
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
    try {
        const current = document.cookie.split("; ").find(value => value.startsWith("fintrack-theme="));
        if (current !== `fintrack-theme=${theme}`) {
            document.cookie = `fintrack-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        }
    } catch {
        // Theme colors still update when cookies are unavailable.
    }
    const color = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim()
        || (theme === "dark" ? "#111214" : "#f4fbf6");
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
        themeColor = document.createElement("meta");
        themeColor.name = "theme-color";
        document.head.appendChild(themeColor);
    }
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
        if (meta.content !== color) meta.content = color;
        if (meta.hasAttribute("media")) meta.removeAttribute("media");
    });
}
export function ThemeProvider({ children }: {
    children: ReactNode;
}) {
    const [system,setSystemState] = useState(false);
    const [theme, setThemeState] = useState<Theme>("light");
    useEffect(() => {
        // Navigation can replace Next.js metadata after the theme is applied.
        const observer = new MutationObserver(() => {
            applyTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
        });
        observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content", "media"] });
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        let savedTheme: string | null = null;
        let savedSystem: string | null = null;
        try {
            savedTheme = localStorage.getItem("fintrack-theme");
            savedSystem = localStorage.getItem("fintrack-theme-system");
        } catch {
            // Use the device preference when browser storage is unavailable.
        }
        const followsSystem = savedSystem === "true" || (savedSystem !== "false" && savedTheme !== "light" && savedTheme !== "dark");
        const stored: Theme = followsSystem
            ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
            : savedTheme === "dark" ? "dark" : "light";
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
    const setSystem=useCallback((value:boolean)=>{setSystemState(value);try{localStorage.setItem("fintrack-theme-system",String(value));}catch{}},[]);
    const setTheme=useCallback((value: Theme) => {
        setSystem(false);
        setThemeState(value);
        applyTheme(value);
        try {
            localStorage.setItem("fintrack-theme", value);
        }
        catch {
            // Keep the selected theme for this session without persistence.
        }
    },[setSystem]);
    const value=useMemo(()=>({theme,setTheme,system,setSystem}),[theme,setTheme,system,setSystem]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
    return useContext(ThemeContext);
}
