<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class LiveUserPackagesController
{
    /**
     * List packages assigned to a user
     * GET /live/users/{user_id}/packages
     */
    public static function list(string $userId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($userId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_USER_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            SELECT
                up.user_id,
                up.package_id,
                p.name AS package_name,
                up.status,
                up.starts_at,
                up.ends_at
            FROM user_packages up
            JOIN packages p ON p.id = up.package_id
            WHERE up.user_id = :user_id
            ORDER BY p.name ASC
        ");
        $st->execute(['user_id' => (int)$userId]);
        $items = $st->fetchAll(PDO::FETCH_ASSOC);
        $st->closeCursor();

        Http::json([
            'ok' => true,
            'items' => $items,
        ]);
    }

    /**
     * Assign package to user
     * POST /live/users/{user_id}/packages
     */
    public static function create(string $userId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($userId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_USER_ID'], 400);
        }

        $body = Http::bodyJson();

        $packageId = $body['package_id'] ?? null;
        $status    = $body['status'] ?? 'active';
        $startsAt  = $body['starts_at'] ?? null;
        $endsAt    = $body['ends_at'] ?? null;

        if (
            !is_numeric($packageId) ||
            !in_array($status, ['active', 'paused', 'expired'], true)
        ) {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                INSERT INTO user_packages
                    (user_id, package_id, status, starts_at, ends_at)
                VALUES
                    (:user_id, :package_id, :status, :starts_at, :ends_at)
            ");
            $st->execute([
                'user_id'    => (int)$userId,
                'package_id' => (int)$packageId,
                'status'     => $status,
                'starts_at'  => $startsAt,
                'ends_at'    => $endsAt,
            ]);
            $st->closeCursor();
        } catch (PDOException $e) {
            // Duplicate composite PK (user_id, package_id)
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        Http::json(['ok' => true], 201);
    }

    /**
     * Update user package
     * PUT /live/users/{user_id}/packages/{package_id}
     */
    public static function update(string $userId, string $packageId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($userId) || !ctype_digit($packageId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $body = Http::bodyJson();

        $status   = $body['status'] ?? null;
        $startsAt = $body['starts_at'] ?? null;
        $endsAt   = $body['ends_at'] ?? null;

        if (
            $status !== null &&
            !in_array($status, ['active', 'paused', 'expired'], true)
        ) {
            Http::json(['ok' => false, 'error' => 'INVALID_STATUS'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            UPDATE user_packages
            SET
                status = COALESCE(:status, status),
                starts_at = :starts_at,
                ends_at = :ends_at
            WHERE user_id = :user_id
              AND package_id = :package_id
        ");

        $st->execute([
            'user_id'    => (int)$userId,
            'package_id' => (int)$packageId,
            'status'     => $status,
            'starts_at'  => $startsAt,
            'ends_at'    => $endsAt,
        ]);

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }

    /**
     * Remove package from user
     * DELETE /live/users/{user_id}/packages/{package_id}
     */
    public static function delete(string $userId, string $packageId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($userId) || !ctype_digit($packageId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            DELETE FROM user_packages
            WHERE user_id = :user_id
              AND package_id = :package_id
        ");
        $st->execute([
            'user_id'    => (int)$userId,
            'package_id' => (int)$packageId,
        ]);

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }
}
