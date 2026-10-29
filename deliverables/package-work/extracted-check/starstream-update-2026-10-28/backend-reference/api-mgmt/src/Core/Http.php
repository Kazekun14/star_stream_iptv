<?php
declare(strict_types=1);

namespace StarStream\Core;

final class Http
{
    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit; // ← THIS IS REQUIRED
    }

    public static function bodyJson(int $maxBytes = 1048576): array
    {
        $raw = file_get_contents('php://input', false, null, 0, $maxBytes);
        if ($raw === false) {
            self::json(['ok' => false, 'error' => 'INVALID_BODY'], 400);
        }

        $raw = trim($raw);
        if ($raw === '') {
            self::json(['ok' => false, 'error' => 'INVALID_JSON'], 400);
        }

        $data = json_decode($raw, true);

        if (!is_array($data)) {
            self::json(['ok' => false, 'error' => 'INVALID_JSON'], 400);
        }

        return $data;
    }

    public static function query(): array
    {
        // Convenience for controllers
        return $_GET ?? [];
    }

    public static function clientIp(): string
    {
        // Best-effort. If you later add trusted proxy handling, update here.
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return is_string($ip) ? $ip : '';
    }

    public static function userAgent(): string
    {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return is_string($ua) ? $ua : '';
    }

    public static function bearerToken(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
        if (!$auth || !is_string($auth)) return null;

        if (preg_match('/^Bearer\\s+(.*)$/i', trim($auth), $m)) {
            return trim((string)$m[1]);
        }
        return null;
    }
}
