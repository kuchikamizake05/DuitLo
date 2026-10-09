import {notFound} from "next/navigation";
import {localLogoEditorEnabled} from "@/server/local-logo-editor";
import {LogoEditor} from "@/components/LogoEditor";
export const dynamic="force-dynamic";
export default function LocalLogoEditorPage(){if(!localLogoEditorEnabled())notFound();return <LogoEditor/>;}
