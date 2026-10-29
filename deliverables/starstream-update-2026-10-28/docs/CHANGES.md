# Included current behavior

This summary describes the collected current source. Without an original source baseline it cannot establish which lines/files changed relative to production. All active frontend modules are included to prevent a partial CSS/component/API-client update.

| Area | Included implementation |
| --- | --- |
| Shell/navigation | Responsive collapsible sidebar, mobile navigation, page-search control, current-page highlighting, sign-out control and admin account menu with local date/time. |
| IPTV identity | Local Cebu Cable logo, `IPTV management for` caption and `Cebu Cable Internet` name beside the account control. Static identity only; no provider switching or filtering. |
| Branding | Local Star Stream SVG logo/favicon, base title `Star Stream IPTV`, per-page browser titles. |
| Routes | Canonical `/portal`, `/dashboard`, `/categories`, `/channels`, `/packages`, `/package-channels`, `/users`, `/settings`; aliases in `App.tsx` redirect old paths while preserving query/hash/state. This changes URL paths, not the public hostname or DNS. |
| Appearance | Settings > Appearance with Dark (default) and Light previews; immediate global theme, browser-local persistence under `starstream-theme`, early initialization, storage-failure fallback, storage-event synchronization, shared colors across pages/components. |
| Settings | Account profile editing, password changes and active-session listing/revocation. These require matching backend routes/schema and are not frontend-only. |
| Login | Redesigned portal, loading/auth guard, remember-me request behavior. Backend reference implements the opt-in 30-day session behavior. |
| Dashboard | Counts, package/channel metrics, health display and package chart. Requires matching metrics responses. |
| Users | Directory/search/paging, account editing, status controls and package assignments with confirmation dialogs; uses current API-client contracts. |
| Channels/categories | Redesigned tables/forms, pagination and channel-logo upload UI. Uploaded operational logos are not packaged. |
| Packages | Package management and channel assignment UI. |
| Shared UI | Modal/confirm behavior, notifications, responsive styles, reusable table and icons, theme-aware contrast. |

## Known additions during this work

`src/theme.ts`, `src/theme.css`, `src/components/AppearanceSettings.tsx`, and `public/cebu-cable-internet.png` were added during this session. Other files may also be new relative to your original system; determine that using the generated comparison plan and your own repository.

The temporary provider dropdown was intentionally removed. `ProviderFilter.tsx` is not included and is not imported by the current app. If an intermediate release contains that obsolete component, it may be manually deleted after confirming it has no consumers. The helper intentionally does not delete arbitrary old files.

## Dependency changes

The Appearance feature adds no npm packages and uses existing React/browser APIs. Both `package.json` and `package-lock.json` are included as the current dependency contract, not evidence that production already has those versions. Existing React, React Router, TypeScript, Vite and plugin versions must be reconciled with production. Package versions are recorded in `DEPENDENCIES.json`.

Backend code is included only for comparison/integration because UI settings and other API features cannot work against incompatible endpoints. Public channel metadata routing is included solely because the collected route table refers to it; it is not an instruction to replace or expose your IPTV streaming system. Streaming servers, infrastructure configuration and customer data are outside this package.
