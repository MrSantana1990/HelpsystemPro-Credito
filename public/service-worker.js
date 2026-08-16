self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Nenhuma resposta da API ou dado financeiro é armazenado offline.
self.addEventListener("fetch", () => {});
