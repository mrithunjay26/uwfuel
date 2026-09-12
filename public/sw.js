const CACHE = "uwfuel-v5";
const TILE_CACHE = "uwfuel-tiles-v1";
const TILE_LIMIT = 600;

const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "basemaps.cartocdn.com",
  "a.basemaps.cartocdn.com",
  "b.basemaps.cartocdn.com",
  "c.basemaps.cartocdn.com",
  "d.basemaps.cartocdn.com",
];
const ASSET_HOSTS = ["unpkg.com"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_LIMIT) return;
  const excess = keys.length - TILE_LIMIT;
  await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  if (fresh && (fresh.status === 200 || fresh.type === "opaque")) {
    cache.put(req, fresh.clone());
    if (cacheName === TILE_CACHE) trimTileCache();
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (TILE_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(req, TILE_CACHE).catch(() => caches.match(req).then((r) => r || Response.error())));
      return;
    }
    if (ASSET_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(req, CACHE).catch(() => caches.match(req).then((r) => r || Response.error())));
    }
    return;
  }

  if (url.pathname === "/version.json") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, CACHE).catch(() => caches.match(req).then((r) => r || Response.error())));
    return;
  }

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

const reminderTimers = new Map();

function showReminder(r) {
  self.registration.showNotification(r.title || "Reminder", {
    body: r.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: r.id,
    data: { url: r.url || "/today" },
    vibrate: [200, 100, 200],
    actions: [{ action: "view", title: "Open" }],
  }).catch(() => {});
}

function clearReminder(id) {
  const entry = reminderTimers.get(id);
  if (entry) {
    clearTimeout(entry.timeout);
    reminderTimers.delete(id);
  }
}

function armReminder(r) {
  const delay = r.fireAt - Date.now();
  if (delay < 0) return;
  const timeout = setTimeout(() => {
    reminderTimers.delete(r.id);
    showReminder(r);
  }, delay);
  reminderTimers.set(r.id, { timeout, fireAt: r.fireAt });
}

function syncReminders(list) {
  const incoming = new Map((list || []).map((r) => [r.id, r]));
  for (const [id, entry] of reminderTimers) {
    const next = incoming.get(id);
    if (!next || next.fireAt !== entry.fireAt) clearReminder(id);
  }
  for (const r of list || []) {
    if (reminderTimers.has(r.id)) continue;
    armReminder(r);
  }
}

function cancelAllReminders() {
  for (const id of Array.from(reminderTimers.keys())) clearReminder(id);
  self.registration.getNotifications().then((ns) => {
    ns.forEach((n) => { if (n.tag && n.data && n.data.url) n.close(); });
  }).catch(() => {});
}

self.addEventListener("message", (event) => {
  if (!event.data) return;
  const { type, payload } = event.data;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "SYNC_REMINDERS") {
    syncReminders((payload && payload.reminders) || []);
    return;
  }

  if (type === "CANCEL_ALL_REMINDERS") {
    cancelAllReminders();
    return;
  }

  if (type === "TEST_NOTIFICATION") {
    setTimeout(() => showReminder({
      id: "reminder-test",
      title: (payload && payload.title) || "Reminders on",
      body: (payload && payload.body) || "You will get one nudge 30 minutes before each item in My Day.",
      url: "/today",
    }), 500);
    return;
  }
});
