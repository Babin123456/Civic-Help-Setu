# Dynamic content and unsafe HTML

Service guides, notices, community reports, FAQs and source links come from data (an admin form, an import, browser storage), not from our code. If any of it were inserted into the page as HTML, a `<script>` or `<img onerror=...>` in a guide would run with the site's permissions.

**Policy: dynamic content is plain text.** It is rendered as React children, which React escapes.

## Inventory of raw HTML sinks (checked against `src/`)

| Sink | Found | Notes |
| --- | --- | --- |
| `dangerouslySetInnerHTML` | none | A test fails if one is added. |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `DOMParser` | none | Same test. |
| `eval`, `new Function`, string timers | none | Same test. |
| `document.write` | 3 print windows: `FormTemplatePreview`, `RtiPreviewLetter`, `AppellateEscalationModal` | They build a letter or form for printing. Their text goes through `src/utils/printHtml.js`, which escapes it (separate fix); the windows contain no script. A test fails if a fourth appears. |
| Links built from data (`href={...}`) | 15 places showing `sourceUrl`, `officialUrl`, `reviewedSource.url`, `officialSource.url`, `chunk.sourceUrl`, ... | All now use `safeHttpUrl`, see below. |

## What the code does

`src/utils/safeContent.js`:

- **`safeHttpUrl(value)`** returns a normalized `http:`/`https:` URL, or `''`. It rejects `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, protocol-relative and relative URLs, URLs with credentials, values with a tab or line break inside (browsers delete those, so `java<TAB>script:` would pass a naive check), and anything over 2048 characters. A link with no safe URL is rendered without `href`.
- **`sanitizePlainText(value)`** removes what parses as markup: tags, closing tags, comments, `<!...>`/`<?...>` declarations, whole `script`, `style`, `iframe`, `object`, `embed`, `template`, `noscript`, `svg` and `math` blocks (an unclosed one drops the rest of the text), and control and direction-override characters. It repeats until nothing changes, so `<scr<script>ipt>` cannot rebuild itself.
- **`sanitizeTextFields(object)`** applies that to every string inside saved data.
- It is applied where stored content is **read**: custom service guides (`getAllServices`), notices (`getNotices`) and community audit reports (`getAuditReports`). Reading is the right place because browser storage can be edited, so data may never have passed through any form.

### What stays

Ordinary text with angle brackets is kept: `Fee < 500`, `Income > 2 lakh`, `Processing <= 7 days`, `5 < 10 > 3`, `<500` (a digit is not a tag), `a -> b`, and `<name@example.org>`. A "<" is only treated as markup when it is followed directly by a letter (or `/` and a letter) and a closing `>`, as a browser would. So literal text like `<Form A>` is removed; write "Form A" instead.

## If rich text is ever needed

Do not extend the regexes. Use a maintained allow-list sanitizer (DOMPurify) with an explicit list, for example `b, i, em, strong, p, br, ul, ol, li, a[href]` (links through `safeHttpUrl`, `rel="noopener noreferrer"`), no `style`, no event attributes, no `svg`/`math`, and no `data-*`. Sanitize once, at the point the HTML is created, and add tests for script tags, event handlers, SVG payloads and the angle-bracket cases above. Add the dependency in its own pull request.

## Adding content that shows a URL

Use `href={safeHttpUrl(url) || undefined}`. For phone and email links use `safeTelHref` / `safeMailtoHref`. A test scans the components and fails on a source/notice URL that is put in `href` without `safeHttpUrl`.

## Tests

`src/utils/safeContent.test.jsx`: script tags (including uppercase, unclosed, split and nested), event handlers, SVG and math payloads, iframes, styles, comments, declarations; ordinary text with angle brackets, Hindi and emoji stays; idempotence; every rejected URL form; stored guides and notices coming back as plain text; real components (`VersionHistoryTimeline`) escaping markup and dropping a `javascript:` link; and the sink inventory above.
