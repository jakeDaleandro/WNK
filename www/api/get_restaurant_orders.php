<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

$uid = intval($_GET['uid'] ?? 0);

$orders = [];

$sql = "
    SELECT
        o.oid,
        p.description AS name,
        p.price,
        o.quantity,
        p.description,
        buyer.name AS purchased_by,
        CASE
            WHEN o.order_type = 'purchase' THEN buyer.name
            WHEN o.order_type = 'donation' THEN needy.name
            ELSE NULL
        END AS pickup_name
    FROM orders o
    JOIN plates p         ON o.plate_id = p.pid
    JOIN users buyer      ON o.user_id = buyer.uid
    LEFT JOIN users needy ON o.needy_id = needy.uid
    WHERE p.rid = $uid
    ORDER BY o.oid DESC
";

$res = $mysqli->query($sql);

while ($row = $res->fetch_assoc()) {
    $orders[] = $row;
}

echo json_encode([
    "success" => true,
    "orders" => $orders
]);
