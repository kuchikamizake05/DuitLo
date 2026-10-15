import {describe, expect, it, vi} from "vitest";
import {watchServiceWorkerUpdates} from "./pwa-registration";

function setup() {
  const worker = Object.assign(new EventTarget(), {state:"installing"});
  const registration = Object.assign(new EventTarget(), {installing:worker,waiting:null});
  let resolve!: (value:ServiceWorkerRegistration)=>void;
  let reject!: (error:Error)=>void;
  const register = vi.fn(()=>new Promise<ServiceWorkerRegistration>((done,fail)=>{resolve=done;reject=fail;}));
  const container = {register,controller:{}} as unknown as ServiceWorkerContainer;
  const onUpdate = vi.fn(), onRegistration = vi.fn(), onError = vi.fn();
  const stop = watchServiceWorkerUpdates(container,{onUpdate,onRegistration,onError});
  return {worker,registration,resolve,reject,stop,onUpdate,onRegistration,onError};
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

  it("reports registration failures only while subscribed",async()=>{
    const active=setup();
    active.reject(new Error("registration failed"));
    await Promise.resolve();await Promise.resolve();
    expect(active.onError).toHaveBeenCalledTimes(1);
    active.stop();
    const disposed=setup();
    disposed.stop();disposed.reject(new Error("late failure"));
    await Promise.resolve();await Promise.resolve();
    expect(disposed.onError).not.toHaveBeenCalled();
  });

  it("announces a waiting update without waiting for a new state event",async()=>{
    const s=setup();
    s.resolve({...s.registration,waiting:s.worker,installing:null,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    expect(s.onRegistration).toHaveBeenCalledTimes(1);
    expect(s.onUpdate).toHaveBeenCalledTimes(1);
    s.stop();
  });
});
