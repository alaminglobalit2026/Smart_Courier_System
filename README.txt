# Smart Courier System

## Run locally
1. Extract this folder.
2. Open `index.html` in Chrome or Microsoft Edge.
3. The demo stores parcel, driver, and notification-preference data in that browser's Local Storage.

## Included
- Dashboard and shipment metrics
- Parcel create, view, edit, delete, search, and status filtering
- Driver create, view, edit, delete, and assignment handling
- Customer tracking lookup by tracking ID
- Delivery status updates
- CSV shipment export and JSON data backup
- Notification preference settings saved in Local Storage
- Responsive layout rules for smaller screens

## Important demo limitations
- Data is browser-local; it is not shared between browsers or devices.
- SMS and email settings are preferences only. No real messages are sent.
- The customer tracking page shows saved shipment status, not live GPS.
- Google Maps live tracking requires a backend, database, driver GPS/location-sharing client, and a maps provider/API key. It is not active in this frontend-only build.
- Dashboard chart bars are illustrative, not calculated from dated shipment history.

## Files
- `index.html` — page structure
- `style.css` — styling and responsive layout
- `script.js` — frontend interactions and Local Storage
