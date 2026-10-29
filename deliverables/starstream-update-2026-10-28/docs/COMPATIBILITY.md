# Compatibility and integration requirements

## Baseline limitation

No original production source, schema, deployment configuration or Git history was available. No guarantee is made that replacing this source on your original system is safe or complete for that system. Determine compatibility by comparison and isolated testing. Exact bytes of collected files are recorded in source-provenance.json. Source backups in the working directory are partial historical artifacts, not a reliable production baseline, and were not used to infer a delta.

## Frontend and hosting

- React 18 / React Router 6, TypeScript and Vite build; exact lockfile versions are in DEPENDENCIES.json. Existing dependencies are required, no theme-specific dependency is added. This is not an offline dependency bundle and no dependency-security audit was performed.
- Modern browsers with CSS custom properties, CSS `:has()`, matchMedia change events and standard localStorage support are expected. Test your actual supported devices. Storage failure falls back to an in-session selection. Theme is a browser preference, not an account or database preference.
- `BrowserRouter` assumes hosting at the origin root. Root-absolute logo paths also assume `/`. A subdirectory deployment needs a separately reviewed Router basename, Vite base and asset-path adaptation; this archive does not silently change them.
- The web server must serve the app entry point for valid client routes, while keeping API, asset, uploaded-media and missing-static-file handling separate. Direct reloads of `/settings` and `/users` must work. Do not route `/api/*` to the HTML entry point.
- Default browser API prefix is `/api`; `VITE_API_BASE` overrides it at build time. The PHP route table itself uses `/auth/...`, `/live/...` and `/dashboard/...`. Your proxy may need to strip `/api` before forwarding. Preserve the existing topology and test it; the excluded development Vite proxy is not a production recipe.
- Cookies are sent with `credentials: include`. Same-origin API hosting is simplest; cross-origin deployments require separately reviewed CORS, cookies, TLS, SameSite and CSRF protections. Preserve destination-specific session policies.
- `index.html` contains an early inline theme initialization script and fallback style. If your host enforces a strict Content Security Policy, authorize these via your reviewed nonce/hash strategy or refactor them in the integration branch. Do not blindly weaken the policy with unrestricted inline scripts.
- Favicon/browser asset caches may retain old branding until cache expiry or a controlled refresh. Preserve hashed asset cache behavior and avoid deleting a previous deployment's assets while clients still use them.
- The admin date/time display uses the viewing browser's locale/timezone; it is not a server timezone configuration change.

## API contract highlights

Use `payload/admin-ui/src/api/*` and the backend reference as the precise contract. The following table summarizes integration checkpoints; it is not a replacement for reading the code.

| Feature | Backend routes (before `/api` proxy prefix) | Required behavior |
| --- | --- | --- |
| Authentication | POST `/auth/login`, GET `/auth/me`, POST `/auth/logout` | JSON `ok`, `admin` identity; `admin_sid` cookie in reference. Remember-me accepts JSON boolean and extends session TTL in reference. |
| Account/security | PUT `/auth/me` | Verify current password; profile fields; optional new password; updated admin response; revoke other sessions on password change. |
| Sessions | GET `/auth/sessions`; POST `/auth/sessions/revoke-others` | Active-session metadata, current-session indicator, password-authorized revocation. |
| Dashboard | GET `/dashboard/metrics`, GET `/health` | Totals and users/channels/categories per package; JSON health. |
| Categories/channels | `/live/categories`, `/live/channels`, item routes | CRUD; channel list supports limit/offset and paging metadata; `logo_uri` expected where applicable. |
| Logo upload | POST `/live/channels/:id/logo` | Multipart `logo` upload, image validation/conversion and media-file linkage. |
| Packages/channels | `/live/packages`, `/live/packages/:package_id/channels` | CRUD and selected channel assignments. |
| Users/packages | `/live/reg-users`, `/live/reg-users/:id`, nested package routes | Directory paging/filtering, account changes and package assignments. |

Backend reference is never installed by the helper. Review permissions, authorization, session revocation semantics, error handling and concurrency against your actual backend. The current reference includes database exception detail in some API errors; ensure your production error policy is appropriate before adopting it. No security audit or backend integration test was performed for this transfer.

## Database requirements and migrations

**No SQL migrations, seed data or database exports are included, and no database was queried or modified to prepare this package.** Pure layout, branding, routes and local themes require no database schema change. This does **not** mean every new account/API feature is compatible with every existing database.

The reference uses MySQL/MariaDB SQL and PDO. In particular:

- Account settings require `admin_users` fields `id`, `username`, `full_name`, `email`, `password_hash`, `status`; profile updates rely on the intended username uniqueness constraint.
- Sessions require `admin_sessions` fields including `session_id`, `admin_id`, `is_revoked`, `ip_address`, `user_agent`, `created_at`, `last_seen_at`, `expires_at`; session timestamps are treated as UTC by the UI.
- Authentication reference invokes stored routines `spm_login`, `spm_session`, `spm_session_touch`, `spm_session_create`, and `spm_session_revoke`. Check their signatures and result columns against the supplied controller code. Routine definitions are not supplied because no validated migration baseline was available.
- Dashboard and management reference require `reg_users`, `packages`, `user_packages`, `package_channels`, `live_channels`, `live_categories` and `media_files`, with the columns/constraints referenced in the PHP source. User UI also expects fields such as `auth_epoch`, `entitlements_version`, status, trial state and connection limits. Verify the complete schema and existing triggers/routines; this list is not an exhaustive schema definition.
- Logo upload requires `live_channels.logo_file_id` and the referenced `media_files` fields. Existing uploaded files and their database URI mappings must be retained.

If your original system lacks any requirement, your coworker/DBA must design, review, back up, test and separately approve an environment-specific migration. Do not import a fresh schema over existing tables or copy example SQL seeds. Password changes/session revocations and other user-data operations cannot be undone by restoring frontend source files.

## Backend runtime/configuration

The reference Composer manifest requires PHP >=8.1 and `vlucas/phpdotenv`; use the included Composer lockfile for comparison. PDO MySQL and image handling support (GD and image functions used in LiveChannelsController) are necessary for the referenced endpoints. Check actual PHP extensions and upload limits before manual integration.

Retain your existing `.env` and review keys without copying values into the patch: `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_SOCKET`, `COOKIE_SECURE`, `COOKIE_DOMAIN`, `COOKIE_SAMESITE`, `MGMT_SESSION_TTL`, `CHANNEL_LOGO_DISK_BASE`, `CHANNEL_LOGO_URL_PREFIX`, `CHANNEL_LOGO_MAX_BYTES`, `CHANNEL_LOGO_MAX_W`, `CHANNEL_LOGO_MAX_H`, `CHANNEL_LOGO_SIZE`. The code has a default logo directory `/opt/starstream/assets/channels/logos`; that is a code fallback, not a verified path on your system. Set your own reviewed path/permissions and URL mapping. Do not change or remove existing channel assets during a frontend update.

No Docker, web-server, proxy, database or runtime configuration is applied by this archive. Existing application secrets and operational configurations remain the coworker's responsibility during integration.
