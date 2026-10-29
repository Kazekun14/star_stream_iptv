<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use Throwable;
use StarStream\Core\Db;

/**
 * UserPackagesController (hardened)
 *
 * Fixes:
 * - DB table name: uses `packages` (not `live_packages`)
 * - Router bug: Router may pass string instead of params array
 * - Router bug: Router may fail to pass :package_id; we fallback parse from REQUEST_URI
 *
 * Routes:
 *  GET    /live/reg-users/:id/packages
 *  POST   /live/reg-users/:id/packages
 *  PUT    /live/reg-users/:id/packages/:package_id
 *  DELETE /live/reg-users/:id/packages/:package_id
 */
final class UserPackagesController
{
  private static function pdo(): PDO {
    return Db::pdo();
  }

  private static function json(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
  }

  private static function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
  }

  /**
   * Router may pass:
   * - array(['id'=>..., 'package_id'=>...])
   * - string("4") for id
   */
  private static function params($params): array {
    if (is_array($params)) return $params;

    if (is_string($params) || is_int($params)) {
      return ['id' => (string)$params];
    }

    return [];
  }

  /**
   * Fallback parse params from URI when router doesn't pass them.
   * Expected paths:
   * - /live/reg-users/4/packages
   * - /live/reg-users/4/packages/5
   * - /api/live/reg-users/4/packages/5  (when behind /api proxy)
   */
  private static function uriFallback(array $params): array {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (!is_string($uri) || $uri === '') return $params;

    // Strip query string
    $path = explode('?', $uri, 2)[0];

    // Match both with/without /api prefix
    if (!isset($params['id'])) {
      if (preg_match('#/(?:api/)?live/reg-users/(\d+)/packages(?:/(\d+))?#', $path, $m)) {
        $params['id'] = $m[1];
        if (!empty($m[2])) $params['package_id'] = $m[2];
      }
    } else {
      // id exists but package_id missing
      if (!isset($params['package_id'])) {
        if (preg_match('#/(?:api/)?live/reg-users/\d+/packages/(\d+)#', $path, $m)) {
          $params['package_id'] = $m[1];
        }
      }
    }

    return $params;
  }

  private static function intParam($v, string $name): int {
    if ($v === null || $v === '' || !is_numeric($v)) {
      self::json(['ok' => false, 'error' => "$name must be an integer"], 400);
    }
    return (int)$v;
  }

  private static function optDatetime($v): ?string {
    if ($v === null) return null;
    if (!is_string($v)) return null;
    $v = trim($v);
    if ($v === '') return null;

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return $v . ' 00:00:00';
    if (preg_match('/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/', $v)) return $v;

    return null;
  }

  private static function optStatus($v): ?string {
    if ($v === null) return null;
    if (!is_string($v)) return null;
    $v = trim($v);
    if ($v === '') return null;
    if (!in_array($v, ['active', 'paused', 'expired'], true)) return null;
    return $v;
  }

  private static function ensureUserExists(PDO $pdo, int $userId): void {
    try {
      $st = $pdo->prepare("SELECT id FROM reg_users WHERE id = ? LIMIT 1");
      $st->execute([$userId]);
      if (!$st->fetchColumn()) self::json(['ok' => false, 'error' => 'User not found'], 404);
    } catch (PDOException $e) {
      self::json(['ok' => false, 'error' => 'DB error (users lookup)'], 500);
    }
  }

  /**
   * Your schema has `packages` table (NOT live_packages)
   */
  private static function ensurePackageExists(PDO $pdo, int $packageId): void {
    try {
      $st = $pdo->prepare("SELECT id FROM packages WHERE id = ? LIMIT 1");
      $st->execute([$packageId]);
      if (!$st->fetchColumn()) self::json(['ok' => false, 'error' => 'Package not found'], 404);
    } catch (PDOException $e) {
      self::json(['ok' => false, 'error' => 'DB error (packages lookup)'], 500);
    }
  }

  /**
   * GET /live/reg-users/:id/packages
   * Optional query: ?status=active|paused|expired
   */
  public static function listForUser($params): void
  {
    try {
      $params = self::uriFallback(self::params($params));

      $pdo = self::pdo();
      $userId = self::intParam($params['id'] ?? null, 'id');
      self::ensureUserExists($pdo, $userId);

      $status = self::optStatus($_GET['status'] ?? null);

      $sql = "
        SELECT
          up.user_id,
          up.package_id,
          up.starts_at,
          up.ends_at,
          up.status,
          p.name AS package_name
        FROM user_packages up
        INNER JOIN packages p ON p.id = up.package_id
        WHERE up.user_id = ?
      ";
      $bind = [$userId];

      if ($status !== null) {
        $sql .= " AND up.status = ? ";
        $bind[] = $status;
      }

      $sql .= " ORDER BY up.status ASC, up.starts_at DESC, up.package_id ASC ";

      $st = $pdo->prepare($sql);
      $st->execute($bind);

      self::json(['ok' => true, 'items' => $st->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Throwable $e) {
      self::json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
  }

  /**
   * POST /live/reg-users/:id/packages
   * Body: { package_id, starts_at?, ends_at?, status? }
   */
  public static function createForUser($params): void
  {
    try {
      $params = self::uriFallback(self::params($params));

      $pdo = self::pdo();
      $userId = self::intParam($params['id'] ?? null, 'id');
      self::ensureUserExists($pdo, $userId);

      $b = self::body();

      $packageId = self::intParam($b['package_id'] ?? null, 'package_id');
      self::ensurePackageExists($pdo, $packageId);

      $startsAt = self::optDatetime($b['starts_at'] ?? null);
      $endsAt   = self::optDatetime($b['ends_at'] ?? null);

      if (array_key_exists('starts_at', $b) && ($b['starts_at'] ?? null) !== null && $startsAt === null) {
        self::json(['ok' => false, 'error' => 'Invalid starts_at (use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)'], 400);
      }
      if (array_key_exists('ends_at', $b) && ($b['ends_at'] ?? null) !== null && $endsAt === null) {
        self::json(['ok' => false, 'error' => 'Invalid ends_at (use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)'], 400);
      }

      $status = self::optStatus($b['status'] ?? 'active');
      if ($status === null) {
        self::json(['ok' => false, 'error' => 'Invalid status'], 400);
      }

      if ($startsAt !== null && $endsAt !== null && strtotime($startsAt) > strtotime($endsAt)) {
        self::json(['ok' => false, 'error' => 'starts_at must be <= ends_at'], 400);
      }

      $st = $pdo->prepare("
        INSERT INTO user_packages (user_id, package_id, starts_at, ends_at, status)
        VALUES (?, ?, ?, ?, ?)
      ");
      $st->execute([$userId, $packageId, $startsAt, $endsAt, $status]);

      self::json(['ok' => true]);
    } catch (PDOException $e) {
      // Duplicate PK (user_id, package_id)
      if ((string)$e->getCode() === '23000') {
        self::json(['ok' => false, 'error' => 'User already has this package'], 409);
      }
      self::json(['ok' => false, 'error' => 'Failed to assign package'], 500);
    } catch (Throwable $e) {
      self::json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
  }

  /**
   * PUT /live/reg-users/:id/packages/:package_id
   * Body: any of { starts_at, ends_at, status }
   */
  public static function updateForUser($params): void
  {
    try {
      $params = self::uriFallback(self::params($params));

      $pdo = self::pdo();
      $userId    = self::intParam($params['id'] ?? null, 'id');
      $packageId = self::intParam($params['package_id'] ?? null, 'package_id');

      self::ensureUserExists($pdo, $userId);
      self::ensurePackageExists($pdo, $packageId);

      $st0 = $pdo->prepare("SELECT starts_at, ends_at, status FROM user_packages WHERE user_id=? AND package_id=?");
      $st0->execute([$userId, $packageId]);
      $cur = $st0->fetch(PDO::FETCH_ASSOC);
      if (!$cur) self::json(['ok' => false, 'error' => 'User package not found'], 404);

      $b = self::body();

      $hasStarts = array_key_exists('starts_at', $b);
      $hasEnds   = array_key_exists('ends_at', $b);
      $hasStatus = array_key_exists('status', $b);

      if (!$hasStarts && !$hasEnds && !$hasStatus) {
        self::json(['ok' => false, 'error' => 'No fields to update'], 400);
      }

      $startsAt = $hasStarts ? self::optDatetime($b['starts_at']) : $cur['starts_at'];
      $endsAt   = $hasEnds   ? self::optDatetime($b['ends_at'])   : $cur['ends_at'];
      $status   = $hasStatus ? self::optStatus($b['status'])      : $cur['status'];

      if ($hasStarts && ($b['starts_at'] ?? null) !== null && $startsAt === null) {
        self::json(['ok' => false, 'error' => 'Invalid starts_at (use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)'], 400);
      }
      if ($hasEnds && ($b['ends_at'] ?? null) !== null && $endsAt === null) {
        self::json(['ok' => false, 'error' => 'Invalid ends_at (use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)'], 400);
      }
      if ($hasStatus && self::optStatus($b['status']) === null) {
        self::json(['ok' => false, 'error' => 'Invalid status'], 400);
      }

      if ($startsAt !== null && $endsAt !== null && strtotime($startsAt) > strtotime($endsAt)) {
        self::json(['ok' => false, 'error' => 'starts_at must be <= ends_at'], 400);
      }

      $st = $pdo->prepare("
        UPDATE user_packages
        SET starts_at = ?, ends_at = ?, status = ?
        WHERE user_id = ? AND package_id = ?
      ");
      $st->execute([$startsAt, $endsAt, $status, $userId, $packageId]);

      self::json(['ok' => true]);
    } catch (PDOException $e) {
      self::json(['ok' => false, 'error' => 'Failed to update user package'], 500);
    } catch (Throwable $e) {
      self::json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
  }

  /**
   * DELETE /live/reg-users/:id/packages/:package_id
   */
  public static function deleteForUser($params): void
  {
    try {
      $params = self::uriFallback(self::params($params));

      $pdo = self::pdo();
      $userId    = self::intParam($params['id'] ?? null, 'id');
      $packageId = self::intParam($params['package_id'] ?? null, 'package_id');

      $st = $pdo->prepare("DELETE FROM user_packages WHERE user_id = ? AND package_id = ?");
      $st->execute([$userId, $packageId]);

      if ($st->rowCount() === 0) {
        self::json(['ok' => false, 'error' => 'User package not found'], 404);
      }

      self::json(['ok' => true]);
    } catch (PDOException $e) {
      self::json(['ok' => false, 'error' => 'Failed to remove user package'], 500);
    } catch (Throwable $e) {
      self::json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
  }
}
