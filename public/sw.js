const CACHE = "uwfuel-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the version manifest — it's how the app detects updates.
  if (url.pathname === "/version.json") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
self.addEventListener("push", (event) => {
  let data = { title: "UW Fuel", body: "Time for your meal!", tag: "meal-reminder", url: "/menu" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag,
      data: { url: data.url || "/menu" },
      vibrate: [200, 100, 200],
      requireInteraction: false,
      actions: [
        { action: "view", title: "See menu" },
        { action: "dismiss", title: "Dismiss" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "/menu";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  const { type, payload } = event.data;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "SCHEDULE_MEAL_REMINDER") {
    const { title, body, delayMs, tag, url } = payload;
    setTimeout(() => {
      self.registration.showNotification(title || "Meal time!", {
        body: body || "Your next meal is coming up.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: tag || "meal-reminder",
        data: { url: url || "/menu" },
        vibrate: [200, 100, 200],
        actions: [{ action: "view", title: "See menu" }],
      }).catch(() => {});
    }, Math.max(0, delayMs || 0));
  }

  if (type === "CANCEL_MEAL_REMINDERS") {
    self.registration.getNotifications({ tag: "meal-reminder" }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});
