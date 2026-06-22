/* Emmanuil push service worker. Push-only: shows notifications and focuses the
   app on click. No fetch/caching handlers (we are not an offline app — yet). */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Emmanuil";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : undefined));
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
