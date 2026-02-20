<?php
header("Content-Type: application/json");
require_once '/var/www/src/db.php';

$uid = intval($_POST['uid'] ?? 0);
$oid = intval($_POST['oid'] ?? 0);

if (!$uid || !$oid) {
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

/* ============================================
   CHECK IF NEEDY ALREADY HAS 2 ACTIVE ORDERS
   ============================================ */
$sql = "
    SELECT COUNT(*) AS cnt
    FROM orders
    WHERE needy_id = ?
      AND order_type = 'donation'
      AND order_status IN ('claimed', 'reserved')
";

$stmt = $mysqli->prepare($sql);
$stmt->bind_param("i", $uid);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();

if ($row['cnt'] >= 2) {
    echo json_encode(["success" => false, "error" => "You already have 2 claimed plates."]);
    exit;
}


/* ============================================
   VERIFY ORDER IS UNCLAIMED DONATION
   ============================================ */
$sql = "
    SELECT quantity, order_status, order_type
    FROM orders
    WHERE oid = ?
    LIMIT 1
";

$stmt = $mysqli->prepare($sql);
$stmt->bind_param("i", $oid);
$stmt->execute();
$order = $stmt->get_result()->fetch_assoc();

if (!$order) {
    echo json_encode(["success" => false, "error" => "Order not found."]);
    exit;
}

if ($order['order_type'] !== 'donation' || $order['order_status'] !== 'unclaimed') {
    echo json_encode([
        "success" => false,
        "error" => "This donation is no longer available."
    ]);
    exit;
}


/* ============================================
   CLAIM THE ORDER
   ============================================ */
$sql = "
    UPDATE orders
    SET needy_id = ?, order_status = 'reserved'
    WHERE oid = ?
";

$stmt = $mysqli->prepare($sql);
$stmt->bind_param("ii", $uid, $oid);

if (!$stmt->execute()) {
    echo json_encode(["success" => false, "error" => "Failed to claim donation."]);
    exit;
}

echo json_encode(["success" => true]);

?>
