# Service QR handouts

Published built-in service pages have a **Show QR code** disclosure. The QR code encodes only the site's origin and stable `/services/:id` route, never application values, saved-service history, query parameters or fragments.

Choose **Download printable handout**, open the downloaded HTML file and use the browser's Print command to print it or save a PDF. The handout contains the service name, department, canonical URL and a 240-pixel black-on-white QR image. It deliberately contains no applicant records.

The QR matrix is generated locally with the pinned `qrcode-generator` dependency (no transitive dependencies). SVG embeds the matrix in the page and downloaded handout, so no third-party QR request or CSP expansion is needed. The downloaded handout renders and prints offline; opening the destination guide still requires connectivity.

Archived guides and admin draft previews have no QR action. Browser-local custom guides are also excluded: their records live in localStorage, so another device cannot resolve them. They need a shared publication backend before public QR sharing can be supported safely. Editing a built-in guide does not change its route; archive state is checked when generating a new handout. Already downloaded handouts cannot be revoked, and an archived destination retains the existing retired-service notice.

Validation covers canonical URLs, draft/archive exclusion, browser-local records, HTML escaping, private-field exclusion, download cleanup and the rendered action. Physical phone scanning and printer output should be checked during maintainer review.
