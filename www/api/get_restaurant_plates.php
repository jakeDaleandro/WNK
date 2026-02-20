<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

if (!isset($_GET['uid'])) {
    echo json_encode([
        'success' => false,
        'error' => 'No UID provided'
    ]);
    exit;
}

$uid = intval($_GET['uid']);

$query = "
    SELECT
        p.pid,
        p.description,
        p.price,
        p.quantity - COALESCE(SUM(o.quantity), 0) AS available_quantity,
        p.etime
    FROM plates p
    LEFT JOIN orders o
        ON p.pid = o.plate_id
        AND o.order_status IN ('unclaimed', 'reserved', 'picked_up')  -- count only active orders
    WHERE p.rid = ?
      AND p.etime > NOW()
    GROUP BY p.pid
    HAVING available_quantity > 0
    ORDER BY p.etime ASC
";

$stmt = $mysqli->prepare($query);
$stmt->bind_param("i", $uid);

if (!$stmt->execute()) {
    echo json_encode(["error" => "SQL execution failed: " . $stmt->error]);
    exit();
}

$result = $stmt->get_result();
$plates = [];
while ($row = $result->fetch_assoc()) {
    $plates[] = [
        "pid" => (int)$row['pid'],
        "description" => $row['description'],
        "price" => (float)$row['price'],
        "available_quantity" => (int)$row['available_quantity'],
        "etime" => $row['etime'],
    ];
}

echo json_encode([
    "success" => true,
    "plates" => $plates
]);

$stmt->close();
$mysqli->close();

