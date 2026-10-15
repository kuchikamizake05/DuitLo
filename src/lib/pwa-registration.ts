type UpdateCallbacks = {
  onUpdate: () => void;
  onRegistration: (registration:ServiceWorkerRegistration) => void;
  onError: (error:unknown) => void;
};

export function watchServiceWorkerUpdates(container:ServiceWorkerContainer, callbacks:UpdateCallbacks) {
  let active=true;
  let registration:ServiceWorkerRegistration|null=null;
  let installing:ServiceWorker|null=null;

  function handleStateChange() {
    if (active && installing?.state==="installed" && container.controller) callbacks.onUpdate();
  }
  function handleUpdateFound() {
    installing?.removeEventListener("statechange",handleStateChange);
    installing=registration?.installing??null;
    installing?.addEventListener("statechange",handleStateChange);
  }

  void container.register("/sw.js").then(next=>{
    if (!active) return;
    registration=next;
    callbacks.onRegistration(next);
    if (next.waiting && container.controller) callbacks.onUpdate();
    next.addEventListener("updatefound",handleUpdateFound);
    handleUpdateFound();
  }).catch(error=>{if(active)callbacks.onError(error);});

  return () => {
    active=false;
    registration?.removeEventListener("updatefound",handleUpdateFound);
    installing?.removeEventListener("statechange",handleStateChange);
  };
}
