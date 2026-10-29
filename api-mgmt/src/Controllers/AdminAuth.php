<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use StarStream\Core\Db;
use StarStream\Core\Http;

final class AdminAuth
{
    public const COOKIE = 'admin_sid';

    public static function requireAdmin(bool $touch = true): array
    {
        $sid = $_COOKIE[self::COOKIE] ?? '';
        if ($sid === '') {
            Http::json(['ok' => false, 'error' => 'NOT_AUTHENTICATED'], 401);
        }

        /* session fetch */
        $stmt = Db::pdo()->prepare('CALL spm_session(:sid)');
        $stmt->execute(['sid' => $sid]);
        $row = $stmt->fetch();
        $stmt->closeCursor();

        if (!$row) {
            Http::json(['ok' => false, 'error' => 'INVALID_SESSION'], 401);
        }

        if ((int)$row['is_revoked'] === 1) {
            Http::json(['ok' => false, 'error' => 'SESSION_REVOKED'], 401);
        }

        if (strtotime((string)$row['expires_at']) <= time()) {
            Http::json(['ok' => false, 'error' => 'SESSION_EXPIRED'], 401);
        }

        if (($row['admin_status'] ?? '') !== 'active') {
            Http::json(['ok' => false, 'error' => 'ADMIN_DISABLED'], 403);
        }

        /* touch */
        if ($touch) {
            $stmt = Db::pdo()->prepare('CALL spm_session_touch(:sid)');
            $stmt->execute(['sid' => $sid]);
            $stmt->closeCursor();
        }

        return [
            'admin_id'     => (int)$row['admin_id'],
            'username'     => (string)$row['username'],
            'full_name'    => $row['full_name'] ?? null,
            'email'        => $row['email'] ?? null,
            'sid'          => $row['session_id'],
            'expires_at'   => $row['expires_at'],
            'last_seen_at'=> $row['last_seen_at'],
        ];
    }

    public static function setCookie(string $sid, int $ttl): void
    {
        $secure = ($_ENV['COOKIE_SECURE'] ?? '0') === '1';

        setcookie(self::COOKIE, $sid, [
            'expires'  => time() + $ttl,
            'path'     => '/',
            'domain'   => $_ENV['COOKIE_DOMAIN'] ?? '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => $_ENV['COOKIE_SAMESITE'] ?? 'Lax',
        ]);
    }

    public static function clearCookie(): void
    {
        setcookie(self::COOKIE, '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'domain'   => $_ENV['COOKIE_DOMAIN'] ?? '',
            'secure'   => ($_ENV['COOKIE_SECURE'] ?? '0') === '1',
            'httponly' => true,
            'samesite' => $_ENV['COOKIE_SAMESITE'] ?? 'Lax',
        ]);
    }
}
