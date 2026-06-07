# Quickstart: IM Web UI Optimization

This quickstart describes how the planned implementation should be verified once setup tasks add the missing runtime scripts.

## 1. Install Dependencies

```powershell
npm install
```

The first implementation phase must add `package.json` before this command can succeed.

## 2. Run H5 Dev Server

```powershell
npm run dev:h5
```

Open the printed local URL in a browser. If another port is occupied, use the alternate port printed by the dev server.

## 3. Visual Browser Checkpoints

At each completed phase, verify these viewports:

```text
375x844
768x1024
1024x768
1440x900
```

Required checks:

- Login/register render with correct Chinese text.
- Desktop workbench shows navigation, conversation list, chat area, and right workspace without overlap.
- Mobile/Android layout provides clear list/detail switching and visible back path.
- Message input remains visible and does not hide behind bottom navigation or safe area.
- Right workspace becomes bounded desktop panel or mobile overlay/stacked page.
- Hotlinked avatars/images have fallback placeholders.
- All manifest modules have included/merged/deferred/removed mapping.
- Each story phase records whether the active module, active conversation, message input affordance, and next action are identifiable within 5 seconds.

## 4. Automated H5 Smoke And Screenshot Checks

After setup adds the runtime scripts, run the automated H5 smoke/screenshot checks for the required responsive breakpoints. Record command output, failed screenshots, and any visual differences in `issues/001-im-web-ui-optimization-qa.md`.

## 5. Android Validation

After navigation, safe-area, permission, or APP-PLUS behavior changes, run an Android app/simulator validation. Record the device or simulator name, viewport, issue list, and verification result in `issues/001-im-web-ui-optimization-qa.md`.

## 6. Issue Closure

For every visual or functional issue:

```text
Status: open -> fixing -> fixed -> verified
```

Do not start the next phase until current-stage issues are verified or explicitly deferred with rationale.

Deferred legacy modules may remain only in `specs/001-im-web-ui-optimization/contracts/legacy-manifest-coverage.md` until implementation starts; no route/component placeholder is required before that point.

## 7. Stage Commit

After checks pass and issues are closed, create a Chinese git commit, for example:

```powershell
git status --short
git add -A
git commit -m "feat: 完成聊天主框架适配"
```
