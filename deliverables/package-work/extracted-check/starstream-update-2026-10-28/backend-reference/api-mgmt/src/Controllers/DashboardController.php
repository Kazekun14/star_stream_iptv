<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class DashboardController
{
    public static function metrics(): void
    {
        AdminAuth::requireAdmin(true);

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                SELECT
                  DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS generated_at,
                  (SELECT COUNT(*) FROM reg_users) AS users_total,
                  (SELECT COUNT(*) FROM reg_users WHERE status='active') AS users_active,
                  (SELECT COUNT(*) FROM reg_users WHERE status='disabled') AS users_disabled,
                  (SELECT COUNT(*) FROM reg_users WHERE status='suspended') AS users_suspended,
                  (SELECT COUNT(*) FROM reg_users WHERE is_trial=1) AS users_trial,
                  (SELECT COUNT(*) FROM packages) AS packages_total,
                  (SELECT COUNT(*) FROM live_channels) AS channels_total,
                  (SELECT COUNT(*) FROM live_categories) AS categories_total
            ");
            $st->execute();
            $totals = $st->fetch(PDO::FETCH_ASSOC);
            $st->closeCursor();

            if (!$totals) {
                Http::json(['ok' => false, 'error' => 'FAILED_TOTALS'], 500);
                return;
            }

            // Users, channels and categories per package (active only)
            $st2 = $pdo->prepare("
                SELECT
                  p.id AS package_id,
                  p.name AS package_name,
                  COUNT(DISTINCT up.user_id) AS users_count,
                  COUNT(DISTINCT pc.channel_id) AS channels_count,
                  COUNT(DISTINCT lc.category_id) AS categories_count
                FROM packages p
                LEFT JOIN user_packages up
                  ON up.package_id = p.id
                 AND up.status = 'active'
                LEFT JOIN package_channels pc
                  ON pc.package_id = p.id
                LEFT JOIN live_channels lc
                  ON pc.channel_id = lc.id
                GROUP BY p.id, p.name
                ORDER BY p.id ASC
            ");
            $st2->execute();
            $usersByPackage = $st2->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $st2->closeCursor();

            // Channels per category
            $st3 = $pdo->prepare("
                SELECT
                  c.id AS category_id,
                  c.category AS category_name,
                  COUNT(ch.id) AS channels_count
                FROM live_categories c
                LEFT JOIN live_channels ch
                  ON ch.category_id = c.id
                GROUP BY c.id, c.category
                ORDER BY c.id ASC
            ");
            $st3->execute();
            $channelsByCategory = $st3->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $st3->closeCursor();

            $metrics = [
                'generated_at'     => (string)$totals['generated_at'],

                'users_total'      => (int)$totals['users_total'],
                'users_active'     => (int)$totals['users_active'],
                'users_disabled'   => (int)$totals['users_disabled'],
                'users_suspended'  => (int)$totals['users_suspended'],
                'users_trial'      => (int)$totals['users_trial'],

                'packages_total'   => (int)$totals['packages_total'],
                'channels_total'   => (int)$totals['channels_total'],
                'categories_total' => (int)$totals['categories_total'],

                'users_by_package' => array_map(static function (array $r): array {
                    return [
                        'package_id'       => (int)($r['package_id'] ?? 0),
                        'package_name'     => (string)($r['package_name'] ?? ''),
                        'users_count'      => (int)($r['users_count'] ?? 0),
                        'channels_count'   => (int)($r['channels_count'] ?? 0),
                        'categories_count' => (int)($r['categories_count'] ?? 0),
                    ];
                }, $usersByPackage),

                'channels_by_category' => array_map(static function (array $r): array {
                    return [
                        'category_id'    => (int)($r['category_id'] ?? 0),
                        'category_name'  => (string)($r['category_name'] ?? ''),
                        'channels_count' => (int)($r['channels_count'] ?? 0),
                    ];
                }, $channelsByCategory),
            ];

            Http::json(['ok' => true, 'metrics' => $metrics]);
        } catch (PDOException $e) {
            Http::json([
                'ok' => false,
                'error' => 'SQL_ERROR',
                'message' => $e->getMessage(),
                'info' => $e->errorInfo ?? null,
            ], 500);
        } catch (\Throwable $e) {
            Http::json([
                'ok' => false,
                'error' => 'SERVER_ERROR',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
