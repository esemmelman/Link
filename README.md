# Link v0.3.0

An installable, offline-friendly link dashboard built with plain HTML, CSS, and JavaScript.

## Run locally

From the parent project directory, run a local web server and open `/link-dashboard/`:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000/link-dashboard/`. A web server is required for offline support and installation; opening `index.html` directly is not enough.

Links are stored in the uniquely named `link_deck_links` Supabase table and protected by email/password authentication plus per-user Row Level Security. Run `supabase-schema.sql` once in the Supabase SQL Editor before using the app. Existing browser data migrates after the first successful sign-in.

## Android path

When hosted over HTTPS, Chrome on Android can install Link Deck from the browser menu or the in-app **Install app** button. A later Play Store release can wrap the same hosted PWA with a Trusted Web Activity or package it with Capacitor. Before a store release, add 192×192 and 512×512 PNG launcher icons and replace local-only storage with an authenticated synchronization service if links need to follow the user between devices.
