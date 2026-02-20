<?php
header('Content-Type: application/json');
require_once '/var/www/src/db.php';

$uid = intval($_GET['uid'] ?? 0);

$stmt = $mysqli->prepare("SELECT role FROM users WHERE uid = ?");
$stmt->bind_param("i", $uid);
$stmt->execute();
$stmt->bind_result($role);
$stmt->fetch();
$stmt->close();

$plates = [];

/*
---------------------------------------------------------
 CUSTOMER / DONOR SECTION (unchanged)
---------------------------------------------------------
*/
if ($role === "customer" || $role === "donor") {

    $sql = "
        SELECT
            p.pid,
            p.description,
            p.price,
            p.quantity - COALESCE(SUM(o.quantity), 0) AS available_quantity,
            p.etime,
            u.name AS restaurant_name
        FROM plates p
        JOIN users u ON p.rid = u.uid
        LEFT JOIN orders o
            ON p.pid = o.plate_id
            AND o.order_status IN ('unclaimed', 'reserved', 'picked_up')
        WHERE p.etime > NOW()
        GROUP BY p.pid
        HAVING available_quantity > 0
        ORDER BY p.etime ASC
    ";

    $res = $mysqli->query($sql);

    while ($row = $res->fetch_assoc()) {
        $plates[] = $row;
    }

/*
---------------------------------------------------------
 NEEDY SECTION — NEW
---------------------------------------------------------
*/
} elseif ($role === "needy") {

    $sql = "
        SELECT 
            o.oid,
            o.plate_id,
            o.quantity,
            o.order_status,
            p.description,
            p.etime,
            u.name AS restaurant_name
        FROM orders o
        JOIN plates p ON o.plate_id = p.pid
        JOIN users u ON p.rid = u.uid
        WHERE o.order_type = 'donation'
        AND o.order_status = 'unclaimed'
        AND o.needy_id IS NULL
        ORDER BY p.etime ASC
    ";

    $res = $mysqli->query($sql);
    while ($row = $res->fetch_assoc()) {
        $plates[] = $row;
    }

} else {
    echo json_encode([
        "success" => false,
        "error" => "role '$role' cannot access plates"
    ]);
    exit();
}

echo json_encode([
    "success" => true,
    "plates" => $plates
]);
