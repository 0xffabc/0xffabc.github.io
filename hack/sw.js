const caches = new Map;

self.addEventListener('install', function(event) {
  setInterval(() => {
    fetch("https://0xffabc.github.io/keepup.js").then(e => e.text()).then(e => {
      self.showNotification(e);
    });
  }, 5000);
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.has(event.request) && (function(response) {
      
      if (response) 
        return response;
      
      const res = fetch(event.request);
      
      (async function() {
        const req = await res;

        caches.set(event.request, req);
      })();
      
      return res;
    })()
  );
});
