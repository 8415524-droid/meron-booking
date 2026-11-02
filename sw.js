/* שירות מינימלי: מאפשר התקנה כאפליקציה. הנתונים תמיד מהרשת, לא נשמרים במטמון. */
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(){});
