<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class LivePackagesController
{
    /* ============================================================
     * LIST
     * GET /live/packages
     * ============================================================
     */
    public static function list(): void
    {
        AdminAuth::requireAdmin(true);

        $q = Http::query();

        $limit  = isset($q['limit'])  && ctype_digit((string)$q['limit'])  ? (int)$q['limit']  : 50;
        $offset = isset($q['offset']) && ctype_digit((string)$q['offset']) ? (int)$q['offset'] : 0;

        if ($limit < 1 || $limit > 200 || $offset < 0) {
            Http::json(['ok' => false, 'error' => 'INVALID_PAGING'], 400);
        }

        $status = $q['status'] ?? null;
        if ($status !== null && !in_array($status, ['active', 'disabled'], true)) {
            Http::json(['ok' => false, 'error' => 'INVALID_FILTER'], 400);
        }

        $pdo = Db::pdo();

        $sql = "
            SELECT
                id,
                name,
                status,
                created_at,
                updated_at
            FROM packages
        ";

        $params = [];

        if ($status !== null) {
            $sql .= " WHERE status = :status ";
            $params['status'] = $status;
        }

        $sql .= " ORDER BY name ASC LIMIT :limit OFFSET :offset ";

        $st = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $st->bindValue(':' . $k, $v);
        }
        $st->bindValue(':limit', $limit, PDO::PARAM_INT);
        $st->bindValue(':offset', $offset, PDO::PARAM_INT);
        $st->execute();

        $items = $st->fetchAll(PDO::FETCH_ASSOC);
        $st->closeCursor();

        $totalSql = "SELECT COUNT(*) FROM packages";
        if ($status !== null) {
            $totalSql .= " WHERE status = " . $pdo->quote($status);
        }

        $total = (int)$pdo->query($totalSql)->fetchColumn();

        Http::json([
            'ok' => true,
            'items' => $items,
            'paging' => [
                'limit' => $limit,
                'offset' => $offset,
                'total' => $total,
            ],
        ]);
    }

    /* ============================================================
     * GET ONE
     * GET /live/packages/:id
     * ============================================================
     */
    public static function get(string $id): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            SELECT
                id,
                name,
                status,
                created_at,
                updated_at
            FROM packages
            WHERE id = :id
            LIMIT 1
        ");
        $st->execute(['id' => (int)$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        $st->closeCursor();

        if (!$row) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true, 'item' => $row]);
    }

    /* ============================================================
     * CREATE
     * POST /live/packages
     * ============================================================
     */
    public static function create(): void
    {
        AdminAuth::requireAdmin(true);
        $body = Http::bodyJson();

        $name = trim((string)($body['name'] ?? ''));
        $status = $body['status'] ?? 'active';

        if ($name === '' || !in_array($status, ['active', 'disabled'], true)) {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                INSERT INTO packages (name, status)
                VALUES (:name, :status)
            ");
            $st->execute([
                'name' => $name,
                'status' => $status,
            ]);
            $st->closeCursor();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        Http::json([
            'ok' => true,
            'id' => (int)$pdo->lastInsertId(),
        ], 201);
    }

    /* ============================================================
     * UPDATE
     * PUT /live/packages/:id
     * ============================================================
     */
    public static function update(string $id): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $body = Http::bodyJson();

        $name = isset($body['name']) ? trim((string)$body['name']) : null;
        $status = $body['status'] ?? null;

        if ($name === null && $status === null) {
            Http::json(['ok' => false, 'error' => 'NO_CHANGES'], 400);
        }

        if ($status !== null && !in_array($status, ['active', 'disabled'], true)) {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $fields = [];
        $params = ['id' => (int)$id];

        if ($name !== null) {
            if ($name === '') {
                Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
            }
            $fields[] = 'name = :name';
            $params['name'] = $name;
        }

        if ($status !== null) {
            $fields[] = 'status = :status';
            $params['status'] = $status;
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                UPDATE packages
                SET " . implode(', ', $fields) . "
                WHERE id = :id
            ");
            $st->execute($params);

            if ($st->rowCount() === 0) {
                Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
            }

            $st->closeCursor();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        Http::json(['ok' => true]);
    }

    /* ============================================================
     * DELETE
     * DELETE /live/packages/:id
     * ============================================================
     */
    public static function delete(string $id): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("DELETE FROM packages WHERE id = :id");
        $st->execute(['id' => (int)$id]);

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }
}
