# Mobile Driver PWA on Local LAN & Offline Behavior Guide
*ലാൻ ഫോൺ കണക്ഷനും ഓഫ്‌ലൈൻ പ്രവർത്തനങ്ങളും*

This guide explains how the StarCiti Driver Mobile Web PWA operates when accessed from a driver's smartphone over a local Wi-Fi LAN (`http://<DEV-PC-IP>:5173/#driver`) and details browser security restrictions over plain HTTP vs. HTTPS.

---

### 1. What Works Over Plain HTTP (LAN Wi-Fi)
Even when accessed over an insecure local connection (`http://192.168.x.x:5173`), the core driver workflows function reliably:

- **IndexedDB & Local Storage**: Both mobile Safari (iOS) and Chrome (Android) permit `IndexedDB` access over HTTP. All duty slip entries, opening/closing km, timestamps, and receipt data are written to the local database (`starciti_pwa_db`).
- **Offline Duty Logging & Queueing**: If the driver drives into a zero-signal dead zone or walks away from Wi-Fi, trips remain safely queued in IndexedDB.
- **Photo Capture via Native Camera**: The standard `<input type="file" accept="image/*" capture="environment">` tag uses the phone's native camera app and image picker, which works seamlessly over HTTP.
- **Batch Synchronization**: When connectivity returns, the driver view flushes queued trips to the backend database in strict FIFO order.

---

### 2. What Breaks Over Plain HTTP (Modern Mobile Browser Security Restrictions)
Modern browser engines (Chromium/WebKit) enforce the W3C Secure Contexts specification. Over plain HTTP on a non-localhost IP address:

1. **ServiceWorker Registration is Blocked**:
   - `navigator.serviceWorker.register()` throws a `SecurityError: Only secure origins are allowed`.
   - *Impact*: HTML, JS, and CSS static bundles cannot be pre-cached by a Service Worker for offline launch if the browser tab is closed in an airplane-mode state.
2. **PWA "Add to Home Screen" Banner is Suppressed**:
   - The browser will not display the automated PWA install prompt over HTTP.
   - *Workaround*: Drivers can still bookmark the link or tap "Add to Home Screen" manually in Safari/Chrome.
3. **HTML5 Geolocation API is Disabled**:
   - `navigator.geolocation.getCurrentPosition()` is blocked on non-secure origins.
   - *Impact*: Automatic GPS coordinate capture is disabled; drivers enter route text or locations manually.
4. **Direct WebRTC Camera Streaming (`getUserMedia`) is Blocked**:
   - Direct embedded video viewfinder streaming is disabled. (StarCiti uses standard file-capture photo upload, which is fully supported).
5. **Web Cryptography API (`crypto.subtle`) is Inaccessible**:
   - Cryptographic primitives requiring hardware-backed subtle crypto are unavailable.

---

### 3. How to Enable Full PWA & HTTPS for Drivers

To unlock 100% full PWA offline caching, install prompts, and geolocation without port-forwarding your office router:

1. **Recommended: Free Cloudflare Tunnel (HTTPS)**:
   - Run Cloudflare Tunnel (`cloudflared`) on the host PC pointing to port 5173 or 8080.
   - Drivers access `https://driver.yourdomain.com/#driver` with a valid SSL/TLS certificate. All secure features, service workers, and install prompts work immediately.
2. **Local USB Development (Android)**:
   - Connect phone via USB with USB debugging enabled.
   - Run `adb reverse tcp:5173 tcp:5173`.
   - On the phone, navigate to `http://localhost:5173/#driver`. Android treats `localhost` as a Secure Context even over plain HTTP!
3. **Chrome Flag Workaround (Testing only)**:
   - On Android Chrome, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
   - Add `http://<DEV-PC-IP>:5173` and restart Chrome.
