"use client";
import {useEffect} from "react";
export function useFinancialRefresh(refresh:()=>Promise<void>){useEffect(()=>{const update=()=>void refresh();window.addEventListener("fintrack:data-changed",update);return()=>window.removeEventListener("fintrack:data-changed",update);},[refresh]);}
