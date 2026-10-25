import { describe, expect, it } from "vitest";
import { getLandingAuthCallbackDestination as destination } from "./auth-callback";

describe("authentication callbacks returning to the landing page", () => {
  it("returns successful implicit and PKCE callbacks to the application", () => {
    expect(destination({pathname:"/",search:"",hash:"#access_token=test&refresh_token=test&type=bearer"})).toBe("/dashboard");
    expect(destination({pathname:"/",search:"?code=test&next=%2Fbilling",hash:""})).toBe("/billing");
  });
  it("keeps normal landing visits and login callbacks untouched", () => {
    expect(destination({pathname:"/",search:"",hash:"#product"})).toBeNull();
    expect(destination({pathname:"/login",search:"?code=test",hash:""})).toBeNull();
    expect(destination({pathname:"/",search:"",hash:"#access_token=test"})).toBeNull();
  });
  it("preserves password recovery and rejects external destinations", () => {
    expect(destination({pathname:"/",search:"?next=https://evil.example",hash:"#access_token=test&refresh_token=test&type=recovery"})).toBe("/login?next=%2Fdashboard&mode=update-password");
    expect(destination({pathname:"/",search:"?code=test&next=//evil.example",hash:""})).toBe("/dashboard");
  });
});
