<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class LivePackageChannelsController
{
    /**
     * List channels assigned to a package
     * GET /live/packages/{package_id}/channels
     */
    public static function list(string $packageId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($packageId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_PACKAGE_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            SELECT
                pc.package_id,
                pc.channel_id,
                c.channel_key,
                c.number,
                c.name,
                c.category_id,
                c.enabled
            FROM package_channels pc
            JOIN live_channels c ON c.id = pc.channel_id
            WHERE pc.package_id = :package_id
            ORDER BY c.number ASC
        ");
        $st->execute(['package_id' => (int)$packageId]);
        $items = $st->fetchAll(PDO::FETCH_ASSOC);
        $st->closeCursor();

        Http::json([
            'ok' => true,
            'items' => $items,
        ]);
    }

    /**
     * Get a specific channel mapping in a package
     * GET /live/packages/{package_id}/channels/{channel_id}
     */
    public static function get(string $packageId, string $channelId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($packageId) || !ctype_digit($channelId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            SELECT
                pc.package_id,
                pc.channel_id,
                c.channel_key,
                c.number,
                c.name,
                c.category_id,
                c.enabled
            FROM package_channels pc
            JOIN live_channels c ON c.id = pc.channel_id
            WHERE pc.package_id = :package_id
              AND pc.channel_id = :channel_id
            LIMIT 1
        ");
        $st->execute([
            'package_id' => (int)$packageId,
            'channel_id' => (int)$channelId,
        ]);

        $item = $st->fetch(PDO::FETCH_ASSOC);
        $st->closeCursor();

        if (!$item) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true, 'item' => $item]);
    }

    /**
     * Add a channel to a package
     * POST /live/packages/{package_id}/channels
     * body: { "channel_id": 123 }
     */
    public static function create(string $packageId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($packageId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_PACKAGE_ID'], 400);
        }

        $body = Http::bodyJson();
        $channelId = $body['channel_id'] ?? null;

        if (!is_numeric($channelId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                INSERT INTO package_channels (package_id, channel_id)
                VALUES (:package_id, :channel_id)
            ");
            $st->execute([
                'package_id' => (int)$packageId,
                'channel_id' => (int)$channelId,
            ]);
            $st->closeCursor();
        } catch (PDOException $e) {
            // Duplicate composite PK (package_id, channel_id)
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            // FK fail (unknown package or channel)
            if ((int)($e->errorInfo[1] ?? 0) === 1452) {
                Http::json(['ok' => false, 'error' => 'INVALID_REFERENCE'], 400);
            }
            throw $e;
        }

        Http::json(['ok' => true], 201);
    }

    /**
     * Update the channel set for a package (replace all)
     * PUT /live/packages/{package_id}/channels
     * body: { "channel_ids": [1,2,3] }
     */
    public static function update(string $packageId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($packageId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_PACKAGE_ID'], 400);
        }

        $body = Http::bodyJson();
        $channelIds = $body['channel_ids'] ?? null;

        if (!is_array($channelIds)) {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        // Sanitize
        $clean = [];
        foreach ($channelIds as $v) {
            if (is_int($v) || is_string($v) || is_float($v)) {
                $iv = (int)$v;
                if ($iv > 0) $clean[] = $iv;
            }
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();

        try {
            // Remove all existing
            $st = $pdo->prepare("
                DELETE FROM package_channels
                WHERE package_id = :package_id
            ");
            $st->execute(['package_id' => (int)$packageId]);

            // Insert new set
            if (!empty($clean)) {
                $ins = $pdo->prepare("
                    INSERT INTO package_channels (package_id, channel_id)
                    VALUES (:package_id, :channel_id)
                ");

                foreach ($clean as $cid) {
                    try {
                        $ins->execute([
                            'package_id' => (int)$packageId,
                            'channel_id' => (int)$cid,
                        ]);
                    } catch (PDOException $e) {
                        // Ignore duplicates inside provided list
                        if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                            continue;
                        }
                        // FK fail (bad channel id)
                        if ((int)($e->errorInfo[1] ?? 0) === 1452) {
                            $pdo->rollBack();
                            Http::json(['ok' => false, 'error' => 'INVALID_REFERENCE'], 400);
                        }
                        throw $e;
                    }
                }
            }

            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Http::json(['ok' => true]);
    }

    /**
     * Remove a channel from a package
     * DELETE /live/packages/{package_id}/channels/{channel_id}
     */
    public static function delete(string $packageId, string $channelId): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($packageId) || !ctype_digit($channelId)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            DELETE FROM package_channels
            WHERE package_id = :package_id
              AND channel_id = :channel_id
        ");
        $st->execute([
            'package_id' => (int)$packageId,
            'channel_id' => (int)$channelId,
        ]);

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }
}
