# Avatar 3 map chrome design QA

final result: passed

Visual targets: Downloads/Desktop@2x (1).png (2880x1440, normalized to 1440x720) and Downloads/Mobile@2x (1).png (780x1688, normalized to 390x844). Existing production layout and supplied brand assets retained. No deployment.

Evidence: design-review/map-first-desktop-1440.png; design-review/map-first-mobile-390.png. Same-input side-by-side comparisons: design-review/map-first-desktop-comparison.png and design-review/map-first-mobile-comparison.png. Eight viewport sizes and three map modes recorded in design-review/map-first-responsive.json.

## Findings corrected
- P1: 3D inherited immersive rules hid the mobile search button. Explicit shared-shell rule keeps it visible across every mode.
- P1: Tightened 3D camera fit clipped Park 4 on portrait screens. Re-centred after distance adjustment and added a safety margin; mobile 3D capture shows the complete outer edge.
- P2: Mobile approval text and stamps inherited tiny header sizing. Dialog-specific rules restore 14px registration text and 64x44 image boxes.
- P2: Status pill inherited card padding and grew to 76px. Removed card padding and fixed the pill to 48px; list opens upward and becomes a sheet on mobile.
- P2: Resizing/switching restored long View labels. Shared navigation now keeps short labels while preserving full accessible names.
- P2: Map credits competed with bottom controls. Relocated existing attribution links into clear space without removing them.
- Follow-up: user requested white plot numerals across all map views; restored white numerals. Project chips now remain visible outside approvals on desktop and mobile. Facing uses an aligned icon which survives filter updates. Navy chrome text and primary blue/white controls exceed 4.5:1.

## Verified results
- One header: exactly 64px desktop and 56px compact layouts, consistent across schematic, satellite and 3D.
- Mobile action bar: exactly 80px, with both existing actions inside the viewport.
- Default status list open on desktop; collapsed on compact screens. Live counts preserved, keyboard activation filters plots and selected rows display active state.
- At 1440x720 and 390x844, the complete schematic image is inside the viewport. DOM bounding rectangles show no intersection with floating toolbar, status control or zoom stack. Entrance and all park labels visible in the screenshots.
- Visual satellite and 3D checks show the complete project footprint without chrome obscuring plots or parks.
- Browser flows exercised: search to plot details, Smart Finder count and clearing, Facing matching/reset, status filter/unfilter with Enter, tools drawer, view switching, zoom/recenter, booking and retained selected plot preferences, approvals open with Enter and close with Escape/focus return, mobile search and Find plots.
- Eight widths: 320,390,768,844 landscape,1024,1280,1440,1920. All three modes: no horizontal overflow; booking action remains inside the viewport; correct header height.
- npm run build succeeds; npm test passes 17 tests, including actual schematic touch-handler execution checking pinch anchoring/clamping and separation from satellite/3D engines.
- No browser console errors observed.

## Evidence limits and accepted differences
The references show blank map placeholders. The real approved artwork keeps its original landscape aspect ratio, so mobile contains intentional vertical space rather than stretching the layout. The desktop reference depicts a collapsed status pill; the written requirement to keep desktop status open takes precedence. Supplied Aspirealty logo and existing font/icon library retained.

Physical-device pinch and keyboard/browser chrome behavior were not directly tested: the in-app browser does not support Input.dispatchTouchEvent. Pinch handlers were exercised in automated tests. Local preview is read-only; authenticated saves and live account changes were not repeated for this chrome-only change.

Follow-up evidence: design-review/visible-project-chips-desktop.png and design-review/visible-project-chips-mobile.png. Verified Facing filter/reset retains icon; chips visible at 1440 and 390 widths; header still 64/56px; no horizontal overflow. Build succeeds.

## Compass facing filter — local verification
- Replaced the Facing dropdown with an eight-direction SVG multi-select dial; removed the old facing panel from the live page.
- Desktop 150px; mobile 96px, expanding to 200px. Expanded wedge bounds exceed 44px in both dimensions.
- All eight directions checked in the browser. Exact direction matching preserved: North-West does not match North or West. NE + E matches 92 seed plots.
- Enter/Space toggles, centre clears, Escape clears, outside tap collapses mobile. Selected state survives switching to satellite and 3D.
- Status AND facing verified (Sold + NE/E returns 4). Smart Finder West + NE/E returns zero, with clear available. South has zero seed plots and displays No plots / facing S.
- Schematic opacity .25 and pointer-events none verified; excluded buttons disabled. Satellite excludes 114 of 206 overlays for NE/E. 3D adapter fades labels/model materials and excludes them from mouse/touch picks.
- No schematic pan/zoom changes when selecting. No default dial/map overlap or horizontal overflow at 320, 390, 768, 1063, 1440, 1920px.
- Satellite and 3D visually checked at mobile and desktop. Map fit reserves clear control space.
- Reduced-motion CSS and 3D adapter bypass animation. Physical mobile multi-touch remains outside this browser emulator's capabilities; existing pinch tests pass.
- Build passes; all 18 tests pass. No deployment performed.
- Screenshots: design-review/compass-desktop-idle.png, compass-desktop-ne-e.png, compass-mobile-idle.png, compass-mobile-ne-e.png.
- Final cross-view check also moved the satellite layers button away from the floating search control; desktop DOM bounds confirm no overlap.

## Registration artwork and collision fixes — local verification
- Replaced the RERA chip with assets/project-registrations.png, linked to the existing Telangana RERA certificate URL with its full hover title. Header stays 64px desktop and 56px compact.
- Compass centre now reports matching plot count. NE+E = 92; combined with Available Smart Finder = 88. The Finder toast uses that same intersection count.
- Desktop compass follows expanded legend height with a 16px gap. Short desktop windows use a two-column legend and reserve its measured width when fitting all three views. Mobile sheets temporarily hide the compass while open.
- Mobile view menu uses absolute positioning; opening it closes the status sheet. Menu stays above project chips. Hamburger is vertically centred within its 44px target.
- Finder results occupy a separate control slot. On mobile they sit 16px above the compact compass; they temporarily hide during dial expansion/shrink, returning when the dial closes.
- Map layers reveals its label when open; the collapsed state is icon-only with brand-blue colouring.
- 3D and satellite credits are available through a 44px information disclosure, on hover or click/keyboard. All original attribution text and links are retained; Escape dismisses it.
- Browser checked at 320, 327, 390, 768, 1024 and 1440px, including 327×691, iPad 768×1024 and shorter desktop 1024×650. No horizontal overflow, fixed header heights, no default compass/map overlap. iPad portrait schematic footprint is approximately 733px wide.
- Expanded desktop legend checked in schematic, satellite and 3D; mobile credits and layers checked; all 18 tests and build pass. No deployment.
- Evidence: chrome-desktop-final.png, chrome-mobile-final.png, chrome-ipad-portrait.png, chrome-3d-desktop.png in design-review.
