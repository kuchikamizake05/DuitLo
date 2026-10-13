"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { createContext,useContext,useState,type FormEvent,type ReactNode } from "react";
import { referenceTemplates } from "./templates";
import layouts from "./layouts.json";

export type ReferencePage = keyof typeof referenceTemplates;
const ReferencePageContext = createContext<ReferencePage | null>(null);
export function useReferencePage() { return useContext(ReferencePageContext); }
export type ReferenceField = { value: string | number | boolean; onChange: (value: string) => void; disabled?: boolean };
export type ReferenceProps = {
  page: ReferencePage;
  part?: string;
  values?: Record<string, ReactNode>;
  fields?: Record<string, ReferenceField>;
  attributes?: Record<string, Record<string, unknown>>;
  slots?: Record<string, ReactNode>;
  onAction?: (action: string) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};
export type ReferenceTemplateInput = {theme:"light"|"dark";part:string;api:ReferenceApi};
export type ReferenceApi = {
  text: (source: string, key?:string) => ReactNode;
  action: (source: string) => void;
  attrs: (key: string) => Record<string, unknown>;
  field: (key: string, type: string) => { value?: string | number; checked?: boolean; onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; disabled?: boolean };
  submit: (event: FormEvent<HTMLFormElement>) => void;
  slot: (key: string, render: () => ReactNode) => ReactNode;
};

export function ReferencePart(props: ReferenceProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [localFields, setLocalFields] = useState<Record<string, string>>({});
  const api: ReferenceApi = {
    text(source,key) {
      if(key && props.values && Object.hasOwn(props.values,key))return props.values[key];
      if (props.values && Object.hasOwn(props.values, source)) return props.values[source];
      if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(source))return "—";
      if (source.startsWith("icon:")) return source.slice(5);
      if (/(?:Rp\s*[\d.]+|[\d.,]+\s*Rp)/.test(source)) return t(source).replace(/[+-]?Rp\s*[\d.,]+/g, "—");
      return t(source);
    },
    action(source) {
      if (props.onAction) props.onAction(source);
      else if (/Transfer Saldo/.test(source)) router.push("/accounts?view=transfer");
      else if (/Kelola Limit/.test(source)) router.push("/planning");
      else if (/Tambah Akun/.test(source)) router.push("/accounts?view=create");
      else if (/fintrack-laporan-reference/.test(source)) router.push("/insights");
    },
    attrs(key) { const attributes=props.attributes?.[key]; return { "data-reference-node": key, ...(typeof attributes?.onClick==="function"?{"data-clickable":true}:{}), ...attributes }; },
    field(key, type) {
      const control = props.fields?.[key];
      return {
        ...(type === "checkbox" || type === "radio" ? { checked: Boolean(control?.value ?? localFields[key]) } : { value: String(control?.value ?? localFields[key] ?? "") }),
        disabled: control?.disabled,
        onChange(event) {
          const target = event.target;
          const value = target instanceof HTMLInputElement && target.type === "checkbox" ? (target.checked ? "true" : "false") : target.value;
          if (control) control.onChange(value);
          else setLocalFields(current => ({ ...current, [key]: value }));
        },
      };
    },
    submit(event) { event.preventDefault(); props.onSubmit?.(event); },
    slot(key, render) { return props.slots && Object.hasOwn(props.slots, key) ? props.slots[key] : render(); },
  };
  const Template = referenceTemplates[props.page];
  return <Template theme={theme} part={props.part??"page"} api={api}/>;

}

export function ReferenceRoot({ page, children, contents = false }: { page: ReferencePage; children: ReactNode; contents?: boolean }) {
  const { theme } = useTheme();
  return <ReferencePageContext.Provider value={page}><div className={`ft-reference ${layouts[page].bodyClass[theme]}`} data-page={page} data-theme={theme} style={contents ? { display: "contents", minHeight: 0 } : undefined}>{children}</div></ReferencePageContext.Provider>;
}

export function Symbol({ children, className = "", filled = false }: { children: string; className?: string; filled?: boolean }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{children}</span>;
}
