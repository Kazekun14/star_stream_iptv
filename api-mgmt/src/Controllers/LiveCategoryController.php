<?php
declare(strict_types=1);

namespace StarStream\Controllers;

use PDO;
use PDOException;
use StarStream\Core\Db;
use StarStream\Core\Http;

final class LiveCategoryController
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

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            SELECT
                id,
                category,
                created_at,
                updated_at
            FROM live_categories
            ORDER BY category ASC
            LIMIT :limit OFFSET :offset
        ");
        $st->bindValue(':limit', $limit, PDO::PARAM_INT);
        $st->bindValue(':offset', $offset, PDO::PARAM_INT);
        $st->execute();
        $items = $st->fetchAll(PDO::FETCH_ASSOC);
        $st->closeCursor();

        $total = (int)$pdo
            ->query("SELECT COUNT(*) FROM live_categories")
            ->fetchColumn();

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

    /**
     * IMPORTANT:
     * Router passes POSITIONAL args.
     * Therefore this MUST accept string $id (not array).
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
                category,
                created_at,
                updated_at
            FROM live_categories
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

    public static function create(): void
    {
        $ctx = AdminAuth::requireAdmin(true);
        $body = Http::bodyJson();

        $category = trim((string)($body['category'] ?? ''));
        if ($category === '') {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                INSERT INTO live_categories (category)
                VALUES (:category)
            ");
            $st->execute(['category' => $category]);
            $st->closeCursor();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Http::json(['ok' => false, 'error' => 'DUPLICATE'], 409);
            }
            throw $e;
        }

        $id = (int)$pdo->lastInsertId();

        Http::json(['ok' => true, 'id' => $id], 201);
    }

    public static function update(string $id): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $body = Http::bodyJson();

        $category = trim((string)($body['category'] ?? ''));
        if ($category === '') {
            Http::json(['ok' => false, 'error' => 'INVALID_INPUT'], 400);
        }

        $pdo = Db::pdo();

        $st = $pdo->prepare("
            UPDATE live_categories
            SET category = :category, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $st->execute([
            'id' => (int)$id,
            'category' => $category,
        ]);
        $st->closeCursor();

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }

    public static function delete(string $id): void
    {
        AdminAuth::requireAdmin(true);

        if (!ctype_digit($id)) {
            Http::json(['ok' => false, 'error' => 'INVALID_ID'], 400);
        }

        $pdo = Db::pdo();

        try {
            $st = $pdo->prepare("
                DELETE FROM live_categories
                WHERE id = :id
            ");
            $st->execute(['id' => (int)$id]);
            $st->closeCursor();
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1451) {
                Http::json(['ok' => false, 'error' => 'HAS_DEPENDENCIES'], 409);
            }
            throw $e;
        }

        if ($st->rowCount() === 0) {
            Http::json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        Http::json(['ok' => true]);
    }
}
