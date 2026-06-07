# Platform Compatibility Contract

This contract records dependency and platform API compatibility checks before adoption.

## Compatibility Rules

- Every new dependency MUST be checked for H5 and APP-PLUS/Android compatibility before it is added to `package.json`.
- Every platform API usage MUST document the guarded platform scope, such as `#ifdef H5` or `#ifdef APP-PLUS`, and the fallback UX for unsupported platforms.
- Compatibility findings that affect implementation or QA MUST be referenced in `issues/001-im-web-ui-optimization-qa.md`.

## Dependency/API Review Table

| Item | Type | H5 Compatible | APP-PLUS/Android Compatible | Guard/Fallback | Notes |
|------|------|---------------|-----------------------------|----------------|-------|
| uni-app runtime | dependency | Yes | Yes | Use uni-app platform APIs only | Confirmed during T001 (using 3.0.0-alpha-4010820240508002) |
| Vue 3 | dependency | Yes | Yes | N/A | Confirmed during T001 (using v3.4.21) |
| Pinia | dependency | Yes | Yes | N/A | Confirmed during T001 (using v2.1.7) |
| markdown-it | dependency | Yes | Yes | Configure `html: false`; unsupported formats use preview fallback | Added for Markdown file preview rendering; pure JS package with no DOM-only dependency in renderer setup |
| katex | dependency | Yes | Yes, via JS/WebView DOM rendering; Android visual smoke pending | Static import in Markdown preview with Vite `optimizeDeps.include`; custom `markdown-it` math rules render block/inline formulas; `throwOnError: false` keeps malformed formulas visible instead of breaking preview | Added for Markdown formula preview, including `$$...$$` blocks and table-cell formulas such as `$$L$$`. CSS is imported from `katex/dist/katex.min.css`; no native platform API. Verified in H5 build and 5173 dev server on 2026-06-06. |
| mammoth | dependency | Yes | Yes, via JS/WebView runtime | Static import in DOCX preview with Vite `optimizeDeps.include`; sanitize generated HTML before `v-html`; fallback to download/open externally if parsing fails | Added for real `.docx` body preview. Pure JS package using JSZip/xmldom; no native platform API. Verified in H5 build and 5173 dev server on 2026-06-05. |
| jszip | dependency | Yes | Yes, via JS/WebView runtime | Static import in Office preview with Vite `optimizeDeps.include`; unsupported legacy `.xls`/`.ppt` binary files show explicit download fallback | Added for real `.xlsx` OpenXML workbook parsing and `.pptx` slide package parsing. Avoided `xlsx` package because npm audit reports high-severity issues with no fixed version. Verified in H5 build and 5173 dev server on 2026-06-05. |
| pdfjs-dist | dependency | Yes | Yes, via JS/WebView Canvas/Worker runtime; Android visual smoke pending | Static import in PPTX converted-PDF preview with Vite `optimizeDeps.include`; use `pdf.worker.min.mjs?url`; render current page to canvas data image instead of iframe; show explicit empty state and keep download action if PDF.js load/render fails | Added for high-fidelity `.pptx` preview through same-name converted PDF such as `test.pptx.pdf`. Browser rendering no longer depends on built-in PDF plugins, which are unreliable in iframe/headless/WebView contexts. `@napi-rs/canvas` appears only as an optional Node dependency of `pdfjs-dist`; browser code uses DOM canvas. Verified in H5 build and 5173 dev server on 2026-06-05. |
| `@dcloudio/uni-ui` / `uni-icons` backing `AppIcon.vue` | dependency | Yes | Yes | `#ifdef H5` keeps the existing SVG path dictionary; `#ifndef H5` uses `uni-icons` font glyphs | Added 2026-06-04 after Android APP-PLUS rendered inline SVG icons as blank boxes. Package is Apache-2.0, v1.5.12, no transitive dependencies. |
| Notification permission APIs | platform API | pending implementation | pending implementation | Guard by platform and show denied/unsupported state | Confirm during T045/T055 |
| Safe-area/navigation APIs | platform API | pending implementation | pending implementation | Guard Android/APP-PLUS behavior and provide CSS fallback | Confirm during T012/T032 |

## Cross-Platform Guard & Fallback Rules

1. **Custom Navigation**: Since we set `"navigationStyle": "custom"` globally in `pages.json`, we MUST guard H5 browser status bar heights and APP-PLUS (Android) status bar heights:
   - Use `uni.getSystemInfoSync().statusBarHeight` to dynamically inject spacing for APP-PLUS.
   - For H5, default status bar spacing is 0.
2. **Style Isolation**: Ensure that `uni.scss` variables are compatible with all compilers by avoiding non-standard CSS functions and wrapping specific vendor rules in platform checks where necessary.
3. **Theme Tokens**: Theme CSS custom properties MUST have a platform-neutral default scope. Keep light tokens on `:root` and theme aliases, and keep Android/AppShell dark-mode aliases such as `.app-shell.dark`; H5-only `document.documentElement` theme classes are not enough for APP-PLUS pages.
