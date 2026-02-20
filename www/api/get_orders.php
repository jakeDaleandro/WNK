<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

$uid = intval($_GET['uid'] ?? 0);

if (!$uid) {
    echo json_encode(["success" => false, "error" => "Missing User ID."]);
    exit();
}

$stmt = $mysqli->prepare("SELECT role FROM users WHERE uid = ?");
$stmt->bind_param("i", $uid);
$stmt->execute();
$stmt->bind_result($role);
$stmt->fetch();
$stmt->close();

if (!$role) {
    echo json_encode(["success" => false, "error" => "User not found or role not set."]);
    exit();
}

$orders = [];

if ($role === "customer") {
    // Existing query for customer purchases
    $sql = "
        SELECT
            o.oid,
            p.pid,
            p.description,
            p.price,
            o.quantity,
            o.order_status,
            o.order_date,
            u.name AS restaurant_name,
            p.etime
        FROM orders o
        JOIN plates p ON o.plate_id = p.pid
        JOIN users u ON p.rid = u.uid
        WHERE o.user_id = $uid
          AND o.order_type = 'purchase'
        ORDER BY o.order_date DESC
    ";

    $res = $mysqli->query($sql);
    while ($row = $res->fetch_assoc()) {
        $orders[] = $row;
    }
} elseif ($role === "donor") {
    // Existing query for donor orders
    $sql = "
        SELECT
            o.oid,
            p.pid,
            p.description,
            p.price,
            o.quantity,
            o.order_status,
            o.order_date,
            u.name AS restaurant_name,
            p.etime,
            o.needy_id
        FROM orders o
        JOIN plates p ON o.plate_id = p.pid
        JOIN users u ON p.rid = u.uid
        WHERE o.user_id = $uid
          AND o.order_type = 'donation'
        ORDER BY o.order_date DESC
    ";

    $res = $mysqli->query($sql);
    while ($row = $res->fetch_assoc()) {
        $orders[] = $row;
    }
// /api/get_orders.php (Needy Role Section)

} elseif ($role === "needy") {

    $sql = "
        SELECT
            o.oid,
            p.pid,
            p.description,
            p.price,
            o.quantity,
            o.order_status,
            o.order_date,
            u.name AS restaurant_name,
            p.etime,
            o.user_id AS donor_id
        FROM orders o
        JOIN plates p ON o.plate_id = p.pid
        JOIN users u ON p.rid = u.uid
        WHERE o.needy_id = $uid
          AND o.order_type = 'donation'
          AND o.order_status IN ('reserved', 'picked_up') 
        ORDER BY o.order_date DESC
    ";

    $res = $mysqli->query($sql);
    while ($row = $res->fetch_assoc()) {
        $orders[] = $row;
    }
} 
else {
    echo json_encode(["success" => false, "error" => "role_not_allowed"]);
    exit();
}
echo json_encode([
    "success" => true,
    "orders" => $orders
]);

?>