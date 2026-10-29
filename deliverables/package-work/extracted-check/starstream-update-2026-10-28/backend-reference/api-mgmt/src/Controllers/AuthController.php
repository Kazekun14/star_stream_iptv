<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use StarStream\Core\Db;
use StarStream\Core\Http;

final class AuthController
{
    public static function health(): void
    {
        Http::json([
            'ok' => true,
            'service' => 'starstream-mgmt',
            'timestamp' => gmdate('c'),
        ], 200);
    }

    public static function login(): void
    {
        $raw = file_get_contents('php://input');
        $body = is_string($raw) ? json_decode($raw, true) : null;

        if (!is_array($body)) {
            Http::json(['ok' => false, 'error' => 'INVALID_JSON'], 400);
        }

        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($username === '' || $password === '') {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        /* admin */
        $stmt = Db::pdo()->prepare('CALL spm_login(:u)');
        $stmt->execute(['u' => $username]);
        $admin = $stmt->fetch();
        $stmt->closeCursor();

        if (!$admin || ($admin['status'] ?? '') !== 'active') {
            Http::json(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        }

        if (!password_verify($password, (string)$admin['password_hash'])) {
            Http::json(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        }

        /* session */
        $sid = bin2hex(random_bytes(32));

        $ttl = (int)($_ENV['MGMT_SESSION_TTL'] ?? 86400);
        if ($ttl < 300) $ttl = 300;
        // Opt in only with a JSON boolean; preserve the existing default otherwise.
        if (($body['rememberMe'] ?? false) === true) {
            $ttl = 30 * 24 * 60 * 60;
        }

        $expiresAt = gmdate('Y-m-d H:i:s', time() + $ttl);

        $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
            ?? $_SERVER['REMOTE_ADDR']
            ?? null;

        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $stmt = Db::pdo()->prepare(
            'CALL spm_session_create(:sid,:aid,:exp,:ip,:ua)'
        );
        $stmt->execute([
            'sid' => $sid,
            'aid' => (int)$admin['id'],
            'exp' => $expiresAt,
            'ip'  => $ip,
            'ua'  => $ua,
        ]);
        $stmt->closeCursor();

        AdminAuth::setCookie($sid, $ttl);

        Http::json([
            'ok' => true,
            'admin' => [
                'id' => (int)$admin['id'],
                'username' => (string)$admin['username'],
                'full_name' => $admin['full_name'] ?? null,
                'email' => $admin['email'] ?? null,
            ],
        ], 200);
    }


    public static function logout(): void
    {
        $sid = $_COOKIE[AdminAuth::COOKIE] ?? '';

        if ($sid !== '') {
            $stmt = Db::pdo()->prepare('CALL spm_session_revoke(:sid)');
            $stmt->execute(['sid' => $sid]);
            $stmt->closeCursor();
        }

        AdminAuth::clearCookie();
        Http::json(['ok' => true], 200);
    }

    public static function me(): void
    {
        $ctx = AdminAuth::requireAdmin(true);

        Http::json([
            'ok' => true,
            'admin' => [
                'id' => (int)$ctx['admin_id'],
                'username' => (string)$ctx['username'],
                'full_name' => $ctx['full_name'] ?? null,
                'email' => $ctx['email'] ?? null,
            ],
            'session' => [
                'sid' => (string)$ctx['sid'],
                'expires_at' => (string)$ctx['expires_at'],
                'last_seen_at' => (string)($ctx['last_seen_at'] ?? ''),
            ],
        ], 200);
    }
}
