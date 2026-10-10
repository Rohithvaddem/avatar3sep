# Avatar Plot Layouts

Interactive Aspirealty Avatar 1, Avatar 2, and Avatar 3 plot layouts.

## Open the project

Open `avatar 1.html`, `avatar 2.html`, or `avatar 3.html` in a browser. Each project has its own page. Avatar 3 includes Schematic, Satellite, and 3D views, plot details, status filters, and house models.

Satellite imagery requires an internet connection. Embedded assets support opening the HTML files locally.

## Assets

The downloaded **Modern Lego House** is by **Arrcaz**, licensed under **CC BY 4.0**:
https://sketchfab.com/3d-models/modern-lego-house-04d6f854fad246b999419ff8cf5ab309

The house is merged and simplified for distant views, with original geometry retained for close views. Attribution and transformation details are in `downloaded_house_credit.json`.

Aerial imagery is sourced from Esri World Imagery. Background preparation scripts are included.

The **Arc Lamp - Victorian Street Lamp** is by **i-m-a-kitty-cat**, licensed under **CC BY 4.0**:
https://sketchfab.com/3d-models/arc-lamp-victorian-street-lamp-41e1be71fdaf430d9d91c871cf153f0d

Original lamp geometry is retained nearby; a simplified distant model and shared instancing keep repeated lamps efficient. Lamps alternate along house rows beside the road. Details are in `downloaded_streetlight_credit.json`.

Park and border oak trees are by **DJMaesen** (CC BY 4.0):
https://sketchfab.com/3d-models/oak-trees-d841c3bcc5324daebee50f45619e05fc

Park benches are by **adventurer** (CC BY 4.0):
https://sketchfab.com/3d-models/bench--park-14mb-6081a54e64a94edda2c444d81e8aec2c

These models retain their source geometry. Materials are merged per tree variant, textures resized to 512px, and repeated trees/benches use instancing. Asset credit JSON files preserve source attribution.

## Data

This workspace includes sales and customer information. Keep the repository private unless the data has been reviewed for public release.

## Netlify public layout and staff access

`npm run build` creates `dist/`, the only directory to publish. Root files remain the legacy local preview. The production layout is public; the sidebar Staff Login authenticates invited email accounts with Netlify Identity. Invite-only registration and server-assigned `staff` / `director` roles protect editing, customer contact information, CRM notes and exports. Both roles edit plot records; director mode also exposes the existing director UI features.

Anonymous GET requests return an explicit allowlist of plot numbers, sizes, facing, status and dimensions. Raw customer datasets and old passwords are excluded from published assets. PATCH requests verify the authenticated role and request origin, validate fields and use conditional writes in the site-scoped `staff-plots` Netlify Blobs store. Public readers see saved inventory changes.

Use `/login.html` for invitation/password recovery callbacks only; ordinary visitors are redirected to the layout. Netlify production visibility must allow public visitors; previews may remain team-private. No site-wide login gate is required.

Existing Firebase/browser edits are not migrated automatically. Review the authoritative dataset before importing existing edits. Legacy credentials must not be reused.

Run `npm run build` and `npm test`. Use `npx netlify-cli dev` for the backend locally; Python static serving cannot run the production API. Verify invited staff/director login, logout and two-session update conflicts on Netlify before staff rollout.
