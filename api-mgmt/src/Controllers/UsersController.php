<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class UsersController
{
    public static function list(): void
    {
        AdminAuth::requireAdmin(true);

        $q = Http::query();

        $limit  = isset($q['limit'])  && ctype_digit((string)$q['limit'])  ? (int)$q['limit']  : 50;
        $offset = isset($q['offset']) && ctype_digit((string)$q['offset']) ? (int)$q['offset'] : 0;

        if ($limit < 1 || $limit > 200 || $offset < 0) {
            Http::json(['ok' => false, 'error' => 'INVALID_PAGING'], 400);
        }

        $status = $q['status'] ?? null; // active|disabled|suspended|null
        if ($status !== null && !in_array($status, ['active', 'disabled', 'suspended'], true)) {
            Http::json(['ok' => false, 'error' => 'INVALID_FILTER'], 400);
        }

        $search = trim((string)($q['q'] ?? ''));

        $pdo = Db::pdo();

        // Stored-procedure version (Option A)
        // Expected: 2 result sets (items, total)
        // CALL spm_reg_users_list(limit, offset, status, q)
        $st = $pdo->prepare("CALL spm_reg_users_list(:limit, :offset, :status, :q)");
        $st->bindValue(':limit', $limit, PDO::PARAM_INT);
        $st->bindValue(':offset', $offset, PDO::PARAM_INT);

        if ($status === null) $st->bindValue(':status', null, PDO::PARAM_NULL);
        else $st->bindValue(':status', $status, PDO::PARAM_STR);

        $st->bindValue(':q', $search, PDO::PARAM_STR);

        $st->execute();
        $items = $st->fetchAll(PDO::FETCH_ASSOC);

        $total = 0;
        if ($st->nextRowset()) {
            $row = $st->fetch(PDO::FETCH_ASSOC);
            $total = (int)($row['total'] ?? 0);
        }
        $st->closeCursor();

        Http::json([
            'ok' => true,
            'items' => array_map([self::class, 'rowPublic'], $items),
            'paging' => [
                'limit' => $limit,
                'offset' => $offset,
                'total' => $total,
            ],
        ], 200);
    }

    public static function get(array $params): void
    {
        AdminAuth::requireAdmin(true);

        $id = (string)($params['id'] ?? '');
        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        // CALL spm_reg_users_get(id)
        $st = $pdo->prepare("CALL spm_reg_users_get(:id)");
        $st->bindValue(':id', (int)$id, PDO::PARAM_INT);
        $st->execute();
        $row = $st->fetch(PDO::FETCH_ASSOC);
        $st->closeCursor();

        if (!$row) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true, 'item' => self::rowPublic($row)], 200);
    }

    public static function create(): void
    {
        AdminAuth::requireAdmin(true);

        $body = Http::bodyJson();

        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($username === '' || $password === '') {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        // Keep username simple & safe (adjust if you want email as username)
        if (!preg_match('/^[a-zA-Z0-9._-]{3,64}$/', $username)) {
            Http::json(['ok' => false, 'error' => 'INVALID_USERNAME'], 400);
        }

        if (strlen($password) < 6) {
            Http::json(['ok' => false, 'error' => 'WEAK_PASSWORD'], 400);
        }

        $fullName = isset($body['full_name']) ? trim((string)$body['full_name']) : null;
        if ($fullName === '') $fullName = null;

        $email = isset($body['email']) ? trim((string)$body['email']) : null;
        if ($email === '') $email = null;

        $status = $body['status'] ?? 'active';
        if (!in_array($status, ['active', 'disabled', 'suspended'], true)) {
            Http::json(['ok' => false, 'error' => 'INVALID_STATUS'], 400);
        }

        $accountExpiry = $body['account_expiry'] ?? null; // 'YYYY-MM-DD HH:MM:SS' or null
        if ($accountExpiry !== null) {
            $accountExpiry = trim((string)$accountExpiry);
            if ($accountExpiry === '') $accountExpiry = null;
        }

        $isTrial = ($body['is_trial'] ?? 0);
        $isTrial = ($isTrial === true || $isTrial === 1 || $isTrial === '1') ? 1 : 0;

        $maxConnections = $body['max_connections'] ?? 1;
        $maxLiveDevices = $body['max_live_devices'] ?? 1;

        if (!is_numeric($maxConnections) || (int)$maxConnections < 1 || (int)$maxConnections > 1000) {
            Http::json(['ok' => false, 'error' => 'INVALID_MAX_CONNECTIONS'], 400);
        }
        if (!is_numeric($maxLiveDevices) || (int)$maxLiveDevices < 1 || (int)$maxLiveDevices > 1000) {
            Http::json(['ok' => false, 'error' => 'INVALID_MAX_LIVE_DEVICES'], 400);
        }

        $hlsServerId = $body['hls_server_id'] ?? null;
        $hlsServerId = ($hlsServerId === null || $hlsServerId === '') ? null : (int)$hlsServerId;

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if (!$passwordHash) {
            Http::json(['ok' => false, 'error' => 'HASH_FAIL'], 500);
        }

        $pdo = Db::pdo();

        try {
            // CALL spm_reg_users_create(..., @o_id)
            $st = $pdo->prepare("
                CALL spm_reg_users_create(
                    :username,
                    :password_hash,
                    :full_name,
                    :email,
                    :status,
                    :account_expiry,
                    :is_trial,
                    :max_connections,
                    :max_live_devices,
                    :hls_server_id,
                    @o_id
                )
            ");

            $st->bindValue(':username', $username, PDO::PARAM_STR);
            $st->bindValue(':password_hash', $passwordHash, PDO::PARAM_STR);

            if ($fullName === null) $st->bindValue(':full_name', null, PDO::PARAM_NULL);
            else $st->bindValue(':full_name', $fullName, PDO::PARAM_STR);

            if ($email === null) $st->bindValue(':email', null, PDO::PARAM_NULL);
            else $st->bindValue(':email', $email, PDO::PARAM_STR);

            $st->bindValue(':status', $status, PDO::PARAM_STR);

            if ($accountExpiry === null) $st->bindValue(':account_expiry', null, PDO::PARAM_NULL);
            else $st->bindValue(':account_expiry', $accountExpiry, PDO::PARAM_STR);

            $st->bindValue(':is_trial', $isTrial, PDO::PARAM_INT);
            $st->bindValue(':max_connections', (int)$maxConnections, PDO::PARAM_INT);
            $st->bindValue(':max_live_devices', (int)$maxLiveDevices, PDO::PARAM_INT);

            if ($hlsServerId === null) $st->bindValue(':hls_server_id', null, PDO::PARAM_NULL);
            else $st->bindValue(':hls_server_id', $hlsServerId, PDO::PARAM_INT);

            $st->execute();
            $st->closeCursor();

            $id = (int)$pdo->query("SELECT @o_id")->fetchColumn();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        Http::json(['ok' => true, 'id' => $id], 201);
    }

    public static function update(array $params): void
    {
        AdminAuth::requireAdmin(true);

        $id = (string)($params['id'] ?? '');
        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }
        $idInt = (int)$id;

        $body = Http::bodyJson();

        // Build SP args: NULL means "no change"
        $p_username          = null;
        $p_password_hash     = null;
        $p_full_name         = null;
        $p_email             = null;
        $p_status            = null;
        $p_account_expiry    = null;
        $p_is_trial          = null;
        $p_max_connections   = null;
        $p_max_live_devices  = null;
        $p_hls_server_id     = null;

        $changed = false;

        if (array_key_exists('username', $body)) {
            $v = trim((string)$body['username']);
            if ($v === '' || !preg_match('/^[a-zA-Z0-9._-]{3,64}$/', $v)) {
                Http::json(['ok' => false, 'error' => 'INVALID_USERNAME'], 400);
            }
            $p_username = $v;
            $changed = true;
        }

        if (array_key_exists('password', $body)) {
            $pw = (string)$body['password'];
            if (strlen($pw) < 6) {
                Http::json(['ok' => false, 'error' => 'WEAK_PASSWORD'], 400);
            }
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            if (!$hash) {
                Http::json(['ok' => false, 'error' => 'HASH_FAIL'], 500);
            }
            $p_password_hash = $hash;
            $changed = true;
        }

        if (array_key_exists('full_name', $body)) {
            $v = $body['full_name'];
            $p_full_name = ($v === null) ? null : trim((string)$v);
            if ($p_full_name === '') $p_full_name = null; // allow clearing
            $changed = true;
        }

        if (array_key_exists('email', $body)) {
            $v = $body['email'];
            $p_email = ($v === null) ? null : trim((string)$v);
            if ($p_email === '') $p_email = null;
            $changed = true;
        }

        if (array_key_exists('status', $body)) {
            $v = (string)$body['status'];
            if (!in_array($v, ['active', 'disabled', 'suspended'], true)) {
                Http::json(['ok' => false, 'error' => 'INVALID_STATUS'], 400);
            }
            $p_status = $v;
            $changed = true;
        }

        if (array_key_exists('account_expiry', $body)) {
            $v = $body['account_expiry'];
            $p_account_expiry = ($v === null) ? null : trim((string)$v);
            if ($p_account_expiry === '') $p_account_expiry = null;
            $changed = true;
        }

        if (array_key_exists('is_trial', $body)) {
            $v = $body['is_trial'];
            $p_is_trial = ($v === true || $v === 1 || $v === '1') ? 1 : 0;
            $changed = true;
        }

        if (array_key_exists('max_connections', $body)) {
            $v = $body['max_connections'];
            if (!is_numeric($v) || (int)$v < 1 || (int)$v > 1000) {
                Http::json(['ok' => false, 'error' => 'INVALID_MAX_CONNECTIONS'], 400);
            }
            $p_max_connections = (int)$v;
            $changed = true;
        }

        if (array_key_exists('max_live_devices', $body)) {
            $v = $body['max_live_devices'];
            if (!is_numeric($v) || (int)$v < 1 || (int)$v > 1000) {
                Http::json(['ok' => false, 'error' => 'INVALID_MAX_LIVE_DEVICES'], 400);
            }
            $p_max_live_devices = (int)$v;
            $changed = true;
        }

        if (array_key_exists('hls_server_id', $body)) {
            $v = $body['hls_server_id'];
            $p_hls_server_id = ($v === null || $v === '') ? null : (int)$v;
            $changed = true;
        }

        if (!$changed) {
            Http::json(['ok' => false, 'error' => 'NO_CHANGES'], 400);
        }

        $pdo = Db::pdo();

        try {
            // CALL spm_reg_users_update(id, username, password_hash, full_name, email, status, account_expiry, is_trial, max_connections, max_live_devices, hls_server_id)
            $st = $pdo->prepare("
                CALL spm_reg_users_update(
                    :id,
                    :username,
                    :password_hash,
                    :full_name,
                    :email,
                    :status,
                    :account_expiry,
                    :is_trial,
                    :max_connections,
                    :max_live_devices,
                    :hls_server_id
                )
            ");

            $st->bindValue(':id', $idInt, PDO::PARAM_INT);

            if ($p_username === null) $st->bindValue(':username', null, PDO::PARAM_NULL);
            else $st->bindValue(':username', $p_username, PDO::PARAM_STR);

            if ($p_password_hash === null) $st->bindValue(':password_hash', null, PDO::PARAM_NULL);
            else $st->bindValue(':password_hash', $p_password_hash, PDO::PARAM_STR);

            // full_name/email/account_expiry/hls_server_id: allow explicit null to clear
            if (!array_key_exists('full_name', $body)) $st->bindValue(':full_name', null, PDO::PARAM_NULL);
            else if ($p_full_name === null) $st->bindValue(':full_name', null, PDO::PARAM_NULL);
            else $st->bindValue(':full_name', $p_full_name, PDO::PARAM_STR);

            if (!array_key_exists('email', $body)) $st->bindValue(':email', null, PDO::PARAM_NULL);
            else if ($p_email === null) $st->bindValue(':email', null, PDO::PARAM_NULL);
            else $st->bindValue(':email', $p_email, PDO::PARAM_STR);

            if ($p_status === null) $st->bindValue(':status', null, PDO::PARAM_NULL);
            else $st->bindValue(':status', $p_status, PDO::PARAM_STR);

            if (!array_key_exists('account_expiry', $body)) $st->bindValue(':account_expiry', null, PDO::PARAM_NULL);
            else if ($p_account_expiry === null) $st->bindValue(':account_expiry', null, PDO::PARAM_NULL);
            else $st->bindValue(':account_expiry', $p_account_expiry, PDO::PARAM_STR);

            if ($p_is_trial === null) $st->bindValue(':is_trial', null, PDO::PARAM_NULL);
            else $st->bindValue(':is_trial', $p_is_trial, PDO::PARAM_INT);

            if ($p_max_connections === null) $st->bindValue(':max_connections', null, PDO::PARAM_NULL);
            else $st->bindValue(':max_connections', $p_max_connections, PDO::PARAM_INT);

            if ($p_max_live_devices === null) $st->bindValue(':max_live_devices', null, PDO::PARAM_NULL);
            else $st->bindValue(':max_live_devices', $p_max_live_devices, PDO::PARAM_INT);

            if (!array_key_exists('hls_server_id', $body)) $st->bindValue(':hls_server_id', null, PDO::PARAM_NULL);
            else if ($p_hls_server_id === null) $st->bindValue(':hls_server_id', null, PDO::PARAM_NULL);
            else $st->bindValue(':hls_server_id', $p_hls_server_id, PDO::PARAM_INT);

            $st->execute();
            $st->closeCursor();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        Http::json(['ok' => true], 200);
    }

    public static function delete(array $params): void
    {
        AdminAuth::requireAdmin(true);

        $id = (string)($params['id'] ?? '');
        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }
        $idInt = (int)$id;

        $pdo = Db::pdo();

        try {
            // CALL spm_reg_users_delete(id)
            $st = $pdo->prepare("CALL spm_reg_users_delete(:id)");
            $st->bindValue(':id', $idInt, PDO::PARAM_INT);
            $st->execute();
            $st->closeCursor();
        } catch (PDOException $e) {
            // FK constraint violation (has dependencies)
            if ((int)($e->errorInfo[1] ?? 0) === 1451) {
                Http::json(['ok' => false, 'error' => 'HAS_DEPENDENCIES'], 409);
            }
            throw $e;
        }

        Http::json(['ok' => true], 200);
    }

    private static function rowPublic(array $r): array
    {
        return [
            'id' => (int)$r['id'],
            'username' => (string)$r['username'],
            'full_name' => $r['full_name'] === null ? null : (string)$r['full_name'],
            'email' => $r['email'] === null ? null : (string)$r['email'],
            'status' => (string)$r['status'],
            'account_expiry' => $r['account_expiry'] === null ? null : (string)$r['account_expiry'],
            'is_trial' => (int)$r['is_trial'],
            'max_connections' => (int)$r['max_connections'],
            'max_live_devices' => (int)$r['max_live_devices'],
            'auth_epoch' => (int)$r['auth_epoch'],
            'entitlements_version' => (int)$r['entitlements_version'],
            'hls_server_id' => $r['hls_server_id'] === null ? null : (int)$r['hls_server_id'],
            'created_at' => isset($r['created_at']) ? (string)$r['created_at'] : null,
            'updated_at' => isset($r['updated_at']) ? (string)$r['updated_at'] : null,
        ];
    }
}
