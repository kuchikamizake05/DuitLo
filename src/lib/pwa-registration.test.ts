import {describe, expect, it, vi} from "vitest";
import {watchServiceWorkerUpdates} from "./pwa-registration";

function setup() {
  const worker = Object.assign(new EventTarget(), {state:"installing"});
  const registration = Object.assign(new EventTarget(), {installing:worker,waiting:null});
  let resolve!: (value:ServiceWorkerRegistration)=>void;
  const register = vi.fn(()=>new Promise<ServiceWorkerRegistration>(done=>{resolve=done;}));
  const container = {register,controller:{}} as unknown as ServiceWorkerContainer;
  const onUpdate = vi.fn(), onRegistration = vi.fn(), onError = vi.fn();
  const stop = watchServiceWorkerUpdates(container,{onUpdate,onRegistration,onError});
  return {worker,registration,resolve,stop,onUpdate,onRegistration,onError};
}

describe("service worker update subscription",()=>{
  it("reports installation and removes listeners on disposal",async()=>{
    const s=setup();
    s.resolve(s.registration as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    s.worker.state="installed";
    s.worker.dispatchEvent(new Event("statechange"));
    expect(s.onUpdate).toHaveBeenCalledTimes(1);
    s.stop();
    s.registration.dispatchEvent(new Event("updatefound"));
    s.worker.dispatchEvent(new Event("statechange"));
    expect(s.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not attach or notify when registration resolves after disposal",async()=>{
    const s=setup();
    s.stop();
    s.resolve(s.registration as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    s.worker.state="installed";
    s.registration.dispatchEvent(new Event("updatefound"));
    s.worker.dispatchEvent(new Event("statechange"));
    expect(s.onRegistration).not.toHaveBeenCalled();
    expect(s.onUpdate).not.toHaveBeenCalled();
  });

  it("detaches the previous installing worker when a new update starts",async()=>{
    const s=setup();
    s.resolve(s.registration as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    const next=Object.assign(new EventTarget(),{state:"installed"});
    s.registration.installing=next;
    s.registration.dispatchEvent(new Event("updatefound"));
    s.worker.state="installed";
    s.worker.dispatchEvent(new Event("statechange"));
    expect(s.onUpdate).not.toHaveBeenCalled();
    next.dispatchEvent(new Event("statechange"));
    expect(s.onUpdate).toHaveBeenCalledTimes(1);
    s.stop();
  });
});
