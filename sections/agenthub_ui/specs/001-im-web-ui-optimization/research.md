# Research: IM Web UI Optimization

## Decision 1: Add a runnable H5 workflow before UI work

**Decision**: The first implementation phase must add `package.json` and documented H5 dev commands before visual QA can pass.

**Rationale**: The current AgentHub shell has uni-app files but no package/runtime script. The constitution requires browser visual testing after stages, so the app must be runnable before layout work can be verified.

**Alternatives considered**:
- HBuilderX-only workflow: rejected because it is not scriptable enough for repeatable browser QA.
- Delay runtime setup until the end: rejected because every UI stage needs visual verification.

## Decision 2: Use flat, content-dense IM design language

**Decision**: Use a restrained flat design baseline: Messenger-blue primary, clear online green, semantic danger red, 4/8px spacing rhythm, visible focus states, and limited motion.

**Rationale**: UI/UX guidance for productivity IM favors readable, responsive, content-dense screens. The design must improve polish without turning the app into a marketing page or decorative hero layout.

**Alternatives considered**:
- Decorative gradients/glass effects: rejected because dense IM tools need legibility and low visual noise.
- One-tone blue/purple palette: rejected by the constitution and design guidance because it weakens status distinction.

## Decision 3: Preserve old-version module coverage through a mapping contract

**Decision**: Use `contracts/legacy-manifest-coverage.md` as the required coverage map from `manifest.pdf` to new Vue/uni-app pages, panels, or deferred items.

**Rationale**: The PDF lists 37 pages and 57 screenshots. A mapping contract prevents hidden regressions when the optimized UI merges or renames old modules.

**Alternatives considered**:
- Treat the PDF as visual inspiration only: rejected because the user said it contains old UI and corresponding function modules.
- Copy all old screens one-to-one: rejected because optimization may merge flows while preserving capabilities.

## Decision 4: Separate responsive shell from page content

**Decision**: Build `AppShell`, `DesktopSidebar`, and `MobileTabBar` first, then route pages into the shell.

**Rationale**: The legacy UI and React prototype both depend on stable navigation. Keeping shell layout separate reduces repeated responsive logic across pages.

**Alternatives considered**:
- Implement page-specific navigation in every page: rejected because it increases drift and mobile/Android bugs.
- Use only `pages.json` navigation bars: rejected because desktop workbench and right workspace need custom layout.

## Decision 5: Pinia stores by domain, local state by interaction surface

**Decision**: Use domain Pinia stores for app, navigation, conversation, message, contact, agent, file, and settings data. Keep open/closed panels, active tabs, and focus state local unless it must survive route changes.

**Rationale**: This matches the constitution and mirrors `im_web` domain boundaries without over-centralizing transient UI state.

**Alternatives considered**:
- Single global store: rejected because state ownership would become unclear.
- Component-only state: rejected because unread counts, drafts, selected conversation, and settings need shared access.

## Decision 6: One icon wrapper and hotlinked image fallback policy

**Decision**: Route icons through `components/common/AppIcon.vue` backed by an open-source icon source. Use HTTPS avatar/image hotlinks in development with initials fallback.

**Rationale**: The constitution requires open-source icons and lightweight images. A wrapper keeps icon style consistent and replaceable.

**Alternatives considered**:
- Material glyph strings from the React prototype: usable as a reference, but the Vue/uni-app version needs a wrapper that can swap icon libraries.
- Local bitmap icon/image bundles: rejected unless later documented as a production exception.

## Decision 7: Stage QA combines automated H5 smoke/screenshots, visual review, and issue closure

**Decision**: After runtime setup, each implementation stage must run automated H5 smoke/screenshot checks plus manual H5 visual checks at 375px, 768px, 1024px, and 1440px, compare functional coverage with `manifest.pdf`, record the 5-second recognition result, validate Android when affected, and close issues before moving on.

**Rationale**: The app is explicitly cross-platform and UI-focused. Functional tests alone cannot catch layout, safe-area, or text-overlap regressions.

**Alternatives considered**:
- Manual final-only review: rejected by the constitution.
- Desktop-only visual testing: rejected because mobile and Android are first-class targets.
