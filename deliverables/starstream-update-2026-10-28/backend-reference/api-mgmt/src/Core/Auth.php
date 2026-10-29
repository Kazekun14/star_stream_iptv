<?php
declare(strict_types=1);

namespace StarStream\Core;

use Throwable;

final class Auth
{
    /**
     * Returns verified claims and enforces account gates (status/expiry/auth_epoch).
     * On failure, it sends JSON error response and exits the request.
     *
     * @return array<string,mixed>
     */
    

    public static function requireClaims(): array
    {
        $jwt = Http::bearerToken();
        if (!$jwt) { Http::json(['error'=>'unauthorized','message'=>'Missing Bearer token'], 401); exit; }

        try {
            $claims = Jwt::verify($jwt);
        } catch (Throwable $e) {
            Http::json(['error'=>'unauthorized','message'=>'Invalid or expired token'], 401);
            exit;
        }

        $userId = (int)($claims['sub'] ?? 0);
        if ($userId <= 0) {
            Http::json(['error'=>'unauthorized','message'=>'Invalid token subject'], 401);
            exit;
        }

        return $claims;
    }


    public static function requireUserId(): int
    {
        $claims = self::requireClaims();
        return (int)($claims['sub'] ?? 0);
    }
}
