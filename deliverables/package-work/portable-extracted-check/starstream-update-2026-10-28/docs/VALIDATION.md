# Validation and acceptance checklist

## Preparation results

- Collected active frontend source, the two local brand assets, entry HTML, active TypeScript configuration and npm manifest/lockfile with exact-byte provenance.
- Excluded environment files, exports/seed SQL, customer/uploaded content, installed dependencies, built output and historical backup files using explicit collection rules.
- TypeScript type-check passed in an isolated packaging copy with `tsc --project tsconfig.json --incremental false`.
- Vite production build passed in that isolated copy using the supplied neutral configuration example and existing local build tools (Vite 5.4.21; Node 24.13.1). No `npm ci`, installation helper, deployment helper, backend API, or database was invoked. A clean network dependency installation was not tested.
- Patch helper syntax was checked with `node --check`; verify and read-only plan modes were exercised. Apply, backup and rollback modes were deliberately **not executed**, including against dummy targets, per the packaging-only instruction. Those write paths require coworker review and testing in a disposable copy before use.
- Package/source SHA-256 comparisons, package inventory verification, static secret-pattern screening and ZIP entry verification are recorded in PACKAGING-REPORT.json. Pattern screening is not a guarantee that an unreviewed source tree has no sensitive information; all actual environment files and records were excluded.
- Earlier UI work was checked with mocked backend responses for theme switching, persistence, keyboard interaction, blocked storage and 24 responsive route/width combinations. That is historical frontend-only evidence, not a live backend or production integration test of this transfer.
- No original-source diff, production schema comparison, PHP runtime/API integration test, fresh dependency installation, or dependency vulnerability audit was performed. Compatibility must be established by the recipient.

## Coworker acceptance checklist (isolated staging only)

1. Verify package hashes; review the complete comparison plan and textual changes against the original source. Confirm target is a non-production copy. Retain a separate trusted copy of the original source and deployed assets.
2. Confirm Node/npm compatibility, lockfile/dependency differences, PHP requirements where relevant and destination configuration. Review package lifecycle scripts before `npm ci`. Build in staging; do not use the obsolete lint script as a passing release gate without restoring its missing dependencies.
3. Check browser title, favicon and logo loading without console errors. Confirm `IPTV management for / Cebu Cable Internet` appears. No provider switcher should remain.
4. Open each canonical page directly and reload it: `/portal`, `/dashboard`, `/categories`, `/channels`, `/packages`, `/package-channels`, `/users`, `/settings`. Test old `/admin...` aliases, query strings and hashes. Confirm API/static-file errors are not swallowed by an SPA fallback.
5. Test login/logout/expired sessions with disposable accounts. Confirm cookie attributes and remember-me lifetime follow your security policy. Test sidebar, search shortcut/results, account menu, mobile navigation and keyboard focus.
6. Check Dark default, Light selection, reload persistence, switching back, another same-origin tab and browser storage denial. Ensure forms, charts, tables, modal dialogs and portal remain readable in both themes at 390px, 768px and desktop widths.
7. On disposable accounts only, verify profile editing, wrong-password rejection, password confirmation, current-session identification and other-session revocation. Verify unauthenticated requests are rejected. These are real data-changing tests and must not use production accounts.
8. Verify dashboard totals against the staging database. Check paging metadata and empty/error/loading states for directories. Test CRUD, package assignment and logo upload only against disposable staging data and storage. Confirm existing operational assets remain accessible.
9. Before choosing the helper's write modes, rehearse apply and rollback on an expendable copy, compare the before/after file hashes and confirm backup restore. Test refusal after later edits. Keep backup access restricted. Restore using your own normal backup process if the helper is unsuitable for your platform.
10. Get explicit team release approval. The coworker owns production deployment, any migrations, monitoring and environment-specific rollback; none is performed by this package.

## Script limitations

The helper is an offline source-copy utility, not a deployment framework. The review marker is a human safety gate. File metadata restoration is limited to ordinary mode bits and modification times; Windows ACLs, ownership, extended attributes and deployment metadata need your normal backup tools. New files use ordinary readable source-file permissions. Directory cleanup is intentionally conservative. Avoid concurrent edits during apply/rollback. A crash or I/O failure can leave a partial copy; use the backup inventory and your retained source snapshot to recover before continuing.
