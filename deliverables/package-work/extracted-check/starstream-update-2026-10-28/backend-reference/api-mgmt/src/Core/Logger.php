<?php
declare(strict_types=1);

namespace StarStream\Core;

final class Logger
{
    public static function init(): void
    {
        // intentionally empty
    }

    private static function write(string $level, string $msg, array $ctx = []): void
    {
        $line = '[' . gmdate('Y-m-d\TH:i:s\Z') . "] {$level} {$msg}";
        if ($ctx) {
            $line .= ' ' . json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        error_log($line);
    }

    public static function info(string $msg, array $ctx = []): void  { self::write('INFO',  $msg, $ctx); }
    public static function warn(string $msg, array $ctx = []): void  { self::write('WARN',  $msg, $ctx); }
    public static function error(string $msg, array $ctx = []): void { self::write('ERROR', $msg, $ctx); }
}
