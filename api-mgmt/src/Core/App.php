<?php
declare(strict_types=1);

namespace StarStream\Core;

use Throwable;

final class App
{
    public static function run(): void
    {
        self::loadEnv();
        Logger::init();

        Logger::info('Start');

        $router = require self::root() . '/src/Routes/api.php';

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri    = $_SERVER['REQUEST_URI'] ?? '/';

        $router->dispatch($method, $uri);
    }

private static function loadEnv(): void
{
    $root = self::root();
    $envFile = $root . '/.env';

    if (!is_file($envFile) || !is_readable($envFile)) {
        error_log("ENV: .env missing or unreadable at: $envFile");
        return;
    }

    if (!class_exists(\Dotenv\Dotenv::class)) {
        // This is the #1 cause: phpdotenv not installed / not autoloaded
        // error_log("ENV: vlucas/phpdotenv not installed or not autoloaded (Dotenv\\Dotenv missing).");
        return;
    }

    try {
        // Explicit file is safer
        $dotenv = \Dotenv\Dotenv::createImmutable($root, '.env');
        $loaded = $dotenv->safeLoad();

        // Confirm at least one key loaded (debug proof)
        // error_log("ENV: loaded .env keys=" . count($loaded) . " JWT_TTL=" . ($_ENV['JWT_TTL'] ?? 'null'));
    } catch (\Throwable $e) {
        error_log("ENV: dotenv load failed: " . $e->getMessage());
    }
}

    private static function root(): string
    {
        // src/Core/App.php -> project root is 2 levels up from this file's directory
        return dirname(__DIR__, 2);
    }
}
