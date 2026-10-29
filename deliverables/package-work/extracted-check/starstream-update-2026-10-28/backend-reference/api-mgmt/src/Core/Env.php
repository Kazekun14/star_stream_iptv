<?php
declare(strict_types=1);

namespace StarStream\Core;

final class Env
{
    public static function getString(string $key, ?string $default = null): ?string
    {
        // Works even if putenv() is disabled
        $val = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);

        if ($val === false || $val === null) return $default;

        $val = trim((string)$val);
        return ($val === '') ? $default : $val;
    }

    public static function getInt(string $key, int $default = 0): int
    {
        $v = self::getString($key, null);
        if ($v === null) return $default;

        $s = ltrim($v, '-');
        return ctype_digit($s) ? (int)$v : $default;
    }
}
