<?php
// ---- Database settings (XAMPP defaults) ----
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'psu_inventory');
define('TAX_RATE', 0.00);          // e.g. 0.12 for 12% VAT
define('STORE_NAME', 'Palawan State University');
date_default_timezone_set('Asia/Manila');

function db($withDb = true) {
    static $pdo = null, $pdoNoDb = null;
    if ($withDb && $pdo) return $pdo;
    if (!$withDb && $pdoNoDb) return $pdoNoDb;
    $dsn = 'mysql:host=' . DB_HOST . ($withDb ? ';dbname=' . DB_NAME : '') . ';charset=utf8mb4';
    $c = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $c->exec("SET time_zone = '+08:00'");
    if ($withDb) $pdo = $c; else $pdoNoDb = $c;
    return $c;
}
