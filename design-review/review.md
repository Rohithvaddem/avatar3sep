# Avatar 3 customer experience review

Reviewed 5 October 2026. Scope: the local Avatar 3 customer journey, desktop and mobile, including the staff entry screen. This is a design and interaction review, not a security audit or legal verification of property information.

## Overall assessment
The former layout failed at mobile widths because fixed-position controls, header elements and a legend with both top and bottom positioning competed for the same space. The revised light interface separates project identity, view navigation and inventory totals; gives map controls their own space; and keeps drawers and forms usable on small screens.

## Journey and evidence

1. **Understand the project and stock — improved.** Heading is Avatar 3. The header shows 206 total, 201 available including 34 mortgage plots, and 5 sold/booked. A note makes the overlap explicit. The legend retains separate status counts so the 34 mortgage plots remain distinguishable. [Desktop screenshot](11-desktop-light.jpg).
2. **Explore the mobile layout — improved.** View tabs occupy their own row, the map refits when its viewport changes, and the visit action sits below the zoom controls. At 360, 390, 768 and 1280 pixels, DOM geometry checks found no horizontal page overflow or booking/zoom overlap. The entire layout fits initially; users zoom to read individual plots. [Mobile screenshot](05-mobile-light.jpg).
3. **Open search and filters — improved.** The drawer is above its backdrop; the larger logo fills the branding space; search and direction buttons have practical touch targets. Search works with its button and Enter, and invalid numbers produce visible feedback. [Sidebar screenshot](12-sidebar-light.jpg).
4. **Select a plot — improved.** Search for 6 opens its details. The printed plan places the plot at the north/west road junction, supporting North-West; its local JS and JSON records were corrected. The North-West filter now includes plot 6 and eight total matching plots. This is plan-based interpretation, not surveyor certification. [Plot details](09-plot-details-light.jpg).
5. **Find suitable plots — improved.** Finder opens above the drawer and uses a scrollable light dialog. The 150–200 size option no longer includes 100–149. Values above 200 up to 300, and above 300, have matching labels and boundaries. Available includes mortgage and resale for Avatar 3 and returns 201 for unrestricted size/facing. Result feedback no longer covers the legend. [Finder screenshot](04-finder-light.jpg).
6. **Inspect satellite context — improved with limits.** Satellite imagery loaded; layer controls use light surfaces and the zoom buttons are connected to Leaflet. External imagery and availability still depend on their providers. Satellite view does not currently offer individual plot-marker filtering; schematic and 3D views are the appropriate plot-selection surfaces. [Satellite screenshot](08-satellite-mobile.jpg).
7. **Explore 3D — improved with limits.** Toolbar groups wrap inside the mobile viewport. Top-down and plot-number search were exercised; plot 6 opens the inspection drawer. Floating controls are hidden while that drawer is open so its content/actions remain accessible. The 3D status function now reads the dataset instead of overriding plot ranges. Its Available filter includes mortgage/resale. Full model performance across physical phones, every house style, lighting mode and fullscreen combination was not benchmarked. [3D screenshot](06-3d-mobile.jpg), [inspection screenshot](07-plot6-3d.jpg).
8. **Request a site visit — improved; external completion unverified.** The form defaults to Avatar 3, is scrollable on mobile and uses a Continue in WhatsApp action. This describes the real next step: the user sends a message and sales confirms the visit. No booking request was sent during testing. [Visit screenshot](13-visit-light.jpg).
9. **Enter staff access — entry screen reviewed; authenticated workflows unverified.** Login fields use light input surfaces. No credentials were entered, and inventory edits, customer administration, pricing tools, exports and other staff-only operations were not exercised. Their end-to-end review requires an authorized test account and test data.

## Additional improvements worth prioritizing

- Add a searchable list companion to the map. A fitted map on a phone cannot make 206 plot numbers readable at once; a list would make comparison and keyboard navigation much easier.
- Preserve a selected plot, filter and camera position across view changes. Keep an explicit distinction between inclusive availability and the underlying mortgage status everywhere inventory is presented.
- Add a short explanation of mortgage plots and the next verification step using wording approved by the business. The design changes do not establish title, release status or purchase eligibility.
- Consolidate legacy style files into one token-based design system. The new light stylesheet intentionally sits after existing styles; many older rules use fixed coordinates and hard-coded colors, creating future maintenance risk.
- Add a reusable accessible dialog controller with reliable focus trapping, restoration, Escape behavior, labels and live result announcements. Visible focus rings, labelled map controls and reduced-motion support were added; full screen-reader compliance has not been established.
- Measure 3D loading time and memory on ordinary Android/iOS phones. Offer clear loading/failure feedback and default to the lightweight schematic when hardware cannot sustain the model.
- Audit staff-only flows with a dedicated account before claiming a product-wide operational review. Verify live updates across schematic and 3D after inventory edits, and display freshness or synchronization state.

## Verification boundaries
JavaScript syntax checks and git diff whitespace checks pass. Browser checks covered the customer flows described above and responsive geometry. No external WhatsApp message, booking, login, database write, deployment or push was performed. External approval claims, property dimensions, legal status and every plot's source-facing assignment were not independently certified. The earlier correction to the reversed 62–66 column is preserved.

## Evidence
Screenshots are stored beside this report. Final screenshots were inspected locally. Before-state captures document the original crowding; use the final light screenshots linked above for the delivered result. Some intermediate captures include animation transitions and are not used as final design evidence.
