import React from "react";
import { createRoot } from "react-dom/client";
import {LanguageProvider} from "../../../src/components/LanguageProvider";
import BerandaPreview from "../../../src/app/design/beranda-preview/page";
import "../../../src/app/globals.css";
import "./preview-fonts.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><LanguageProvider><BerandaPreview /></LanguageProvider></React.StrictMode>);
