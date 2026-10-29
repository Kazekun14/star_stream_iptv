<?php
declare(strict_types=1);

namespace StarStream\Core;

use PDO;
use PDOException;

final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) return self::$pdo;

        $dbName   = Env::getString('DB_NAME', '');
        $dbUser   = Env::getString('DB_USER', '');
        $dbPass   = Env::getString('DB_PASS', '');
        $dbHost   = Env::getString('DB_HOST', 'localhost');
        $dbPort   = Env::getInt('DB_PORT', 3306);
        $dbSocket = Env::getString('DB_SOCKET', null);

        if ($dbSocket) {
            $dsn = sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $dbSocket, $dbName);
        } else {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
        }

        try {
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            Http::json(['error' => 'db_connection_failed', 'message' => $e->getMessage()], 500);
            exit;
        }

        self::$pdo = $pdo;
        return $pdo;
    }
}
