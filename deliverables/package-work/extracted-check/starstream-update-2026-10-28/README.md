# Star Stream IPTV — reviewed-source update package

Prepared: 28 October 2026 (Asia/Manila). Package ID: `starstream-update-2026-10-28`.

## Read this first

This ZIP is for **manual review and integration into an isolated copy of the original system**. It is not a production installer, database migration, or deployment image. No original production source or Git baseline was available. Consequently, the package contains a coherent current frontend snapshot, **not a verified incremental diff**, and compatibility with your original system is unproven. Review every replacement against your original source before accepting it.

No installation, backup, rollback, deployment, API mutation, or database migration was executed when preparing this package. Current application files were collected without modifying them. Backend files are reference material, never automatically installed.

## Why one curated ZIP

Separate per-file ZIPs make dependencies, extraction order, and omitted files hard to track. A whole-project ZIP would include credentials, database exports, installed dependencies, old backups, and local infrastructure settings. This archive instead preserves paths within one selected source snapshot, with a per-file SHA-256 inventory and review-first integration tools.

## Layout

| Folder/file | Purpose |
| --- | --- |
| `payload/admin-ui/` | Current UI source, shared components and API clients, active TypeScript configuration, package manifest/lockfile, HTML entry point, and two branding assets. Paths are relative to the original project root. |
| `backend-reference/api-mgmt/` | Current routed backend controllers, supporting core classes, route table, PHP entry point, Composer manifest and lockfile. Compare and merge only the backend behavior your system needs. |
| `templates/vite.config.example.ts` | Generic build-only configuration example. Original environment-specific Vite proxy configuration is deliberately excluded. |
| `scripts/patch.cjs` | Offline, dependency-free Node helper: verify, plan, backup, apply to a review copy, and rollback source files. |
| `docs/CHANGES.md` | Feature and file-group summary; not a production-baseline diff. |
| `docs/COMPATIBILITY.md` | API, database/schema, routes, hosting, dependencies, and known limitations. |
| `docs/VALIDATION.md` | Preparation checks and coworker acceptance checklist. |
| `docs/FILE-INVENTORY.csv` | Every collected source file with its destination, purpose and hash. |
| `docs/source-provenance.json` | Exact-byte source-to-package mapping. |
| `manifest.json`, `SHA256SUMS.txt` | Package-wide integrity inventory. Hashes detect corruption, not the authenticity of an untrusted sender. |

## Prerequisites

Use Node.js 22 or 24 with npm for review/build and Node.js 18+ for the offline helper. Source preparation was checked with Node 24.13.1. Keep the existing production runtime and hosting configuration under your team's control. Node is a build tool; the frontend output is static files.

Do not copy environment variables, database credentials or production records into this archive. Build-time `VITE_*` values are public in browser code and must never contain secrets. Dependency installation requires your approved npm registry/network access; installed dependencies are not bundled.

## Step-by-step review and installation into a staging source copy

1. **Extract into a new directory outside any application/web root.** Review this README, compatibility notes, scripts, and source. Retain the original ZIP as received. A hash sent separately through a trusted channel can verify transfer integrity.
2. **Verify the package**, from its extracted root:

   ```sh
   node scripts/patch.cjs verify
   ```

   This is read-only. Unexpected, missing, or changed package files cause failure. Put your notes, plans and backups outside the package directory. If your OS creates extra extracted metadata files, remove only those known metadata files before verifying. Do not alter signed-off package contents to bypass a mismatch.
3. **Create an isolated copy/branch of your actual original source.** Use a non-production database with disposable test accounts if you later test backend features. Do not point a development proxy at production. Take your team's normal full backup of source, deployed static assets, configuration, uploaded files, and database if backend integration is planned. The included source backup is not a substitute for those backups.
4. **Compare without modifying the copy**:

   ```sh
   node /path/to/extracted-package/scripts/patch.cjs plan --target /path/to/review-copy > /path/to/review-plan.json
   ```

   On Windows, use a text editor or PowerShell `Out-File -Encoding utf8` to save JSON as UTF-8. `--target` is the directory containing `admin-ui/package.json`, not `admin-ui` itself. Each file is marked `add`, `replace`, or `unchanged` based on this target's hashes. Inspect textual diffs with your normal editor/Git tools. Add/replace status here describes the chosen target, not a proven historical change. No files are deleted by applying the package.
5. **Resolve compatibility and local changes.** Preserve your environment files, Vite server/proxy configuration, web server config, domain, API routing and infrastructure. The installer copies whole listed files; it does not merge. For divergent files, integrate manually into a branch instead of using `apply`. Compare `package.json` and its lockfile as a pair. Do not let this snapshot erase your original dependencies or custom behavior without deliberate review. Backend integration is always manual; use `backend-reference` and `docs/COMPATIBILITY.md` as supporting evidence, not as a directory to overwrite.
6. **Optional reviewed source copying.** Only if every replacement is accepted, create a file named `.starstream-review-copy` at the staging project root containing exactly:

   ```text
   NON_PRODUCTION_REVIEW_COPY
   ```

   This marker is a deliberate human declaration, not an automatic proof of safety. Never create it in production. Create an empty backup parent outside both the review copy and extracted package; protect it using your organization's filesystem access controls. The helper refuses links/junctions, target/package overlap, and unmarked write targets.

   ```sh
   # Optional independent backup of files the payload would change:
   node /path/to/extracted-package/scripts/patch.cjs backup --target /path/to/review-copy --backup-dir /path/to/source-backups

   # Apply only after reviewing the JSON plan and every replacement:
   node /path/to/extracted-package/scripts/patch.cjs apply --target /path/to/review-copy --plan /path/to/review-plan.json --backup-dir /path/to/source-backups --reviewed
   ```

   Apply creates a new verified backup before copying. The plan is rejected if the target or package has changed since review. Close editors/processes that can modify the target during copying. Per-file replacement is atomic where supported, but the operation is **not a transaction across all files**. On failure, stop and inspect the printed backup location; do not continue to a build or deployment until the source state is understood.
7. **Prepare the build in that isolated copy.** Keep your reviewed Vite config. For an empty scratch workspace only, copy `templates/vite.config.example.ts` to `admin-ui/vite.config.ts`; it has no API proxy and is not a production hosting configuration. Review the npm lockfile and package lifecycle scripts before installing dependencies:

   ```sh
   cd /path/to/review-copy/admin-ui
   npm ci
   npm run build
   ```

   `npm ci` replaces `node_modules` in the chosen staging directory. The build writes `dist` and TypeScript build information there. Neither command is called by the patch helper. Preserve the original `VITE_API_BASE` if appropriate, or use the default `/api` only when the reverse proxy actually supports it. A compiled bundle is deliberately not supplied, because build-time URLs and base paths must be reviewed for the destination.
8. **Validate in isolated staging.** Follow `docs/VALIDATION.md`, including authentication, API response shapes, settings changes using disposable accounts, direct URL reloads, legacy redirects, themes, logos, and small screens. A frontend build passing does not establish backend or database compatibility.
9. **Hand off approved integration through your normal release process.** No deployment automation is included. The coworker owns production approval, database migration design if needed, release/asset deployment, web server changes, and live monitoring. Do not expose backend-reference, docs, backup manifests or source backups through the web server.

## Source rollback

Do not run rollback on an actively edited tree. Preserve any later edits first. From the unchanged extracted package:

```sh
node scripts/patch.cjs rollback --target /path/to/review-copy --backup /path/to/source-backups/starstream-TIMESTAMP-ID --reviewed
```

The helper verifies the backup belongs to this package and target, checks pre-update file hashes, and refuses to overwrite files with later content changes. It restores original touched files and removes only files that this snapshot added and that still match the package. Empty directories may remain. Backups must remain private: they contain your previous source.

Rollback restores **payload source files only**. It does not restore dependencies, build output, localStorage, backend files merged manually, uploaded logos, configuration, database records, passwords or revoked sessions. Restore the separately retained deployed build to roll back a release; rebuild/reinstall from the restored lockfile only in a suitable staging workspace. Any manually integrated backend/database changes require their own reviewed rollback plan. The UI theme preference can be reset manually by clearing `starstream-theme` in browser localStorage.

## Exclusions and integrity

Excluded: all `.env` variants, database SQL exports and seeds, actual database records, application channel-logo uploads, `node_modules`, `vendor`, `dist`, temporary browser profiles/screenshots, old `.before-*`/`.bak.*` files, `phpinfo.php`, Docker/Nginx deployment configuration, multicast diagnostic scripts, generated TypeScript build caches, and editor/machine files. The unused `UsersController.php` is excluded; the active `RegUsersController.php` is included as backend reference.

The original `vite.config.ts` is excluded because its proxy target is environment-specific. Unused `tsconfig.app.json`/`tsconfig.node.json` are excluded because the active `tsconfig.json` does not reference them and they include stale scaffolding options/paths. `eslint.config.js` is excluded because its packages are not declared in the provided manifest: `npm run lint` is **not** a validated command for this snapshot. The coworker can reconcile lint tooling separately without changing the production update scope.

The two logo files are supplied for this requested Star Stream/Cebu Cable deployment. Confirm your organization's right to redistribute those brand assets. The Cebu Cable image matches the provided reference and was sourced from `https://www.cebucable.tv/assets/img/cebucabletv_new_logo.png`; the application uses the bundled local file, not a third-party runtime image request.
