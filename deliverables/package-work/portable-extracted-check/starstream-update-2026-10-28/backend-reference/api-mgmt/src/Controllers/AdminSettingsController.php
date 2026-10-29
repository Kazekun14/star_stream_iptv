<?php
declare(strict_types=1);
namespace StarStream\Controllers;

use StarStream\Core\Db;
use StarStream\Core\Http;

final class AdminSettingsController
{
    private static function body(): array
    {
        if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site'
            || stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            Http::json(['ok' => false, 'message' => 'Invalid request.'], 403);
        }
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) Http::json(['ok' => false, 'message' => 'Invalid request body.'], 400);
        return $body;
    }

    private static function text(array $body, string $key): string
    {
        if (!isset($body[$key]) || !is_string($body[$key])) {
            Http::json(['ok' => false, 'message' => 'Missing or invalid ' . $key . '.'], 400);
        }
        return $body[$key];
    }

    public static function update(): void
    {
        $ctx = AdminAuth::requireAdmin();
        $body = self::body();
        $current = self::text($body, 'current_password');
        $username = trim(self::text($body, 'username'));
        $name = trim(self::text($body, 'full_name'));
        $email = trim(self::text($body, 'email'));
        $password = isset($body['new_password']) ? self::text($body, 'new_password') : '';
        if ($username === '' || strlen($username) > 64 || preg_match('/[\s\x00-\x1f]/', $username)
            || strlen($name) > 255 || strlen($email) > 255
            || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))
            || ($password !== '' && (strlen($password) < 12 || strlen($password) > 72))) {
            Http::json(['ok' => false, 'message' => 'Check your profile fields. New passwords must be 12 to 72 bytes.'], 422);
        }
        $db = Db::pdo();
        try {
            $db->beginTransaction();
            $stmt = $db->prepare('SELECT password_hash FROM admin_users WHERE id = ? AND status = ? FOR UPDATE');
            $stmt->execute([$ctx['admin_id'], 'active']);
            $hash = $stmt->fetchColumn();
            if (!$hash || !password_verify($current, $hash)) {
                $db->rollBack();
                Http::json(['ok' => false, 'message' => 'Your current password is incorrect.'], 403);
            }
            $stmt = $db->prepare('UPDATE admin_users SET username = ?, full_name = ?, email = ?, password_hash = ? WHERE id = ?');
            $stmt->execute([$username, $name ?: null, $email ?: null, $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : $hash, $ctx['admin_id']]);
            if ($password !== '') {
                $stmt = $db->prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE admin_id = ? AND session_id <> ?');
                $stmt->execute([$ctx['admin_id'], $ctx['sid']]);
            }
            $db->commit();
        } catch (\PDOException $e) {
            if ($db->inTransaction()) $db->rollBack();
            if (($e->errorInfo[1] ?? 0) === 1062) Http::json(['ok' => false, 'message' => 'That username is already in use.'], 409);
            Http::json(['ok' => false, 'message' => 'Unable to update your account.'], 500);
        }
        Http::json(['ok' => true, 'admin' => ['id' => (int)$ctx['admin_id'], 'username' => $username, 'full_name' => $name ?: null, 'email' => $email ?: null]]);
    }

    public static function sessions(): void
    {
        $ctx = AdminAuth::requireAdmin();
        $stmt = Db::pdo()->prepare('SELECT ip_address, user_agent, created_at, last_seen_at, expires_at, (session_id = ?) AS is_current FROM admin_sessions WHERE admin_id = ? AND is_revoked = 0 AND expires_at > UTC_TIMESTAMP() ORDER BY is_current DESC, last_seen_at DESC');
        $stmt->execute([$ctx['sid'], $ctx['admin_id']]);
        Http::json(['ok' => true, 'sessions' => $stmt->fetchAll()]);
    }

    public static function revokeOthers(): void
    {
        $ctx = AdminAuth::requireAdmin();
        $body = self::body();
        $current = self::text($body, 'current_password');
        $stmt = Db::pdo()->prepare('SELECT password_hash FROM admin_users WHERE id = ?');
        $stmt->execute([$ctx['admin_id']]);
        if (!password_verify($current, (string)$stmt->fetchColumn())) Http::json(['ok' => false, 'message' => 'Your current password is incorrect.'], 403);
        $stmt = Db::pdo()->prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE admin_id = ? AND session_id <> ?');
        $stmt->execute([$ctx['admin_id'], $ctx['sid']]);
        Http::json(['ok' => true]);
    }
}
