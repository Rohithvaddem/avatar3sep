> Superseded by [final-review.md](final-review.md). This file records an earlier design iteration; project-data pills and the floating sun controls described below have since been removed.

# RDS v3 adaptation for Avatar 3

Source: RDS-v3.pdf, design system v3 revision 1. Read the PDF text and rendered its opening principles and foundation pages. Applied the relevant foundations, forms and provenance guidance from pages 1–16 and 21–28 to the existing Avatar 3 interface.

## Implemented

- RDS neutral ground, white surfaces, navy ink and accessible brand-strong blue.
- Raspberry primary actions; blue-tint selection states; quiet secondary actions.
- Schibsted Grotesk display face and Mona Sans body face, with a 12px floor on interface captions and labels.
- Pill actions and chips, stronger field borders, 48px inputs and 44px touch controls. Plot markers retain map-scaled geometry so they do not obscure adjoining parcels; their detail panels provide readable text.
- Central rt-prefixed colour, typography, radius, spacing and interaction tokens. Existing light stylesheet colours now reference these tokens. The legacy CSS still contains old literals; this is an adapter, not a complete migration of all historical styles.
- Plain source labels: Project data, with explicit not-independently-verified disclosure. No invented Developer, TS-RERA or Visited provenance.
- Approval wording changed to DTCP stated / Project data. There is no green verification claim without verification evidence.
- Legend and satellite layer overlays start collapsed; layer controls support click, Enter and Space.
- Explicit required, unchecked consent before continuing to WhatsApp, naming Aspirealty sales and the data involved. Cab pickup defaults unchecked. No message was sent during verification.
- Preserved Aspirealty branding, the 201 inclusive availability count, plot 6 North-West mapping, responsive map fitting and the existing customer flows.

## Adaptation decisions

The plan and satellite imagery remain authentic source visuals, including any printed colours. Available plot markers use RDS record blue rather than verification green. Mortgage uses amber and sold uses neutral ink; written legend/status labels retain meaning alongside colour.

The group-company relationship does not establish a named advisor, verified approval, free buyer service policy, sponsorship policy or public-record source. These were not fabricated. Add a real advisor name and business-approved service disclosures when supplied. Unknown legal or financial facts require evidence, not visual styling.

## Verification

Checked desktop and mobile screenshots. At 360, 390, 768 and 1280 pixels the page fits horizontally and booking does not overlap zoom. Plot 6 search still opens North-West details with project-data tags. Finder returns 201 for unrestricted available stock. Sharing consent and pickup are unchecked; consent carries the native required attribute. JavaScript syntax and whitespace checks pass.

Screenshots: rds-desktop.jpg and rds-mobile.jpg. Backend actions, message sending, authenticated staff workflows, full accessibility conformance and every 3D combination remain outside this check. Further work: consolidate legacy CSS, add accessible dialog focus management, provide named advisor and verified source records, and add a list companion for map exploration.

Focus-induced map scrolling was fixed with a clipped canvas. The mobile 3D toolbar scrolls within its panel so every control remains reachable; 3D status markers use the same blue, neutral and amber semantics as the plan.
