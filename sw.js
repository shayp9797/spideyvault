const CACHE='spideyvault-v3.3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./catalogue.js','./manifest.webmanifest','./icon.svg',
  './images/ins-399-negative-suit.png',
  './images/ins-397-miles.png',
  './images/ins-334-advanced-suit.png','./images/spider-gwen-405.jpeg','./images/spider-gwen-153-unhooded.jpeg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&event.request.url.startsWith(self.location.origin)){
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    }
    return response;
  }).catch(()=>caches.match('./index.html'))));
});
