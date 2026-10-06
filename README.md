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

## Private Netlify staff deployment

Netlify runs `npm run build` and publishes **dist**, never the repository root.
The build removes raw customer datasets, browser credentials and direct Firebase
access from the deployment. The root files remain the legacy local preview;
they are not the private production build.

The production login uses invited **email accounts**, not the old shared
username/password pairs. Enable Netlify Identity, select **Invite only**, and
assign each user `staff` or `director` in their application roles. Both roles
can read/edit plots; director UI additionally includes quoting tools.
Do not reuse the old frontend passwords. Configure invitation/recovery email
links to `/login.html`. Staff set their own passwords through the invitation.

An Edge Function gates application pages/assets using the Identity session.
The public login screen contains no customer data. Plot reads/updates have
independent server-side role and request-origin checks. Data is stored in the
site-scoped `staff-plots` Netlify Blobs store with strong consistency and
conditional writes. First reads use server-only JSON seeds. Existing Firebase
or browser-local edits are **not migrated automatically**. Import those only
after reviewing which source is authoritative.

Validation: `npm run build`, `npm test`, `node --check dist/app.js`.
Tests cover anonymous/unassigned access, staff/director updates, CSRF,
unknown fields/plots, stale writes, markup encoding and publish exclusions.
For platform testing use `npx netlify-cli dev`. Python's static server cannot
run the private auth APIs/Edge Functions. Verify Identity login, direct asset
denial, two-session update conflicts and logout on Netlify before staff rollout.
