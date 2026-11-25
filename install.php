<?php
// One-click setup: runs database/01_schema.sql and database/02_sample_data.sql
// Open http://localhost/psu_inventory/install.php   (add ?force=1 to wipe an existing database)
require 'config.php';
function runSqlFile($pdo, $file) {
    $delim = ';'; $buf = '';
    foreach (file($file) as $line) {
        if (preg_match('/^DELIMITER\s+(\S+)/i', $line, $m)) { $delim = $m[1]; continue; }
        $t = trim($line);
        if ($buf === '' && ($t === '' || strpos($t, '--') === 0)) continue;
        $buf .= $line;
        if (substr(rtrim($buf), -strlen($delim)) === $delim) {
            $stmt = trim(substr(rtrim($buf), 0, -strlen($delim))); $buf = '';
            if ($stmt !== '') $pdo->exec($stmt);
        }
    }
}
try {
    $pdo = db(false);
    $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='" . DB_NAME . "' AND table_name='users'")->fetchColumn();
    if ($exists && empty($_GET['force'])) {
        die("<h3>Database already exists</h3><p>Installing again would DELETE all data.<br>To reset anyway open <a href='install.php?force=1'>install.php?force=1</a></p><p><a href='index.html'>Go to the system</a></p>");
    }
    runSqlFile($pdo, __DIR__ . '/database/01_schema.sql');
    runSqlFile($pdo, __DIR__ . '/database/02_sample_data.sql');
    echo "<h3>Installation complete &#10004;</h3><p>Database <b>" . DB_NAME . "</b> created with 7 tables, 3 views, 7 triggers and sample data.</p>
    <p>Logins: <b>admin / admin123</b>, <b>cashier / cashier123</b>, <b>clerk / clerk123</b></p><p><a href='index.html'>Go to the system &rarr;</a></p>";
} catch (Throwable $e) { echo "<h3>Install failed</h3><pre>" . htmlspecialchars($e->getMessage()) . "</pre>"; }
