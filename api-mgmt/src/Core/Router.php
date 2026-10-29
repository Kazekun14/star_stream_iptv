<?php
declare(strict_types=1);

namespace StarStream\Core;

final class Router
{
    private array $routes = [];

    /** @param mixed $handler */
    public function add(string $method, string $path, $handler): void
    {
        if (!is_callable($handler)) {
            throw new \InvalidArgumentException('Route handler must be callable');
        }

        $paramNames = [];

        $pattern = preg_replace_callback(
            '#:([a-zA-Z_][a-zA-Z0-9_]*)#',
            function ($m) use (&$paramNames) {
                $paramNames[] = $m[1];
                return '([^/]+)';
            },
            $path
        );

        $pattern = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => $pattern,
            'params'  => $paramNames,
            'handler' => $handler,
        ];
    }

   public function dispatch(): void
{
    $method = $_SERVER['REQUEST_METHOD'];
    $path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    foreach ($this->routes as $r) {
        if ($r['method'] !== $method) {
            continue;
        }

        if (preg_match($r['pattern'], $path, $matches)) {
            array_shift($matches);

            $args = [];
            foreach ($r['params'] as $i => $name) {
                $args[$name] = $matches[$i];
            }

            //user_func_array($r['handler'], $args);
            call_user_func_array($r['handler'], array_values($args));
            return;
        }
    }

    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'NOT_FOUND']);
}

}
