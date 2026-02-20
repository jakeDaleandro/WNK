<?php
header('Content-Type: application/json');
require_once '/var/www/src/db.php';

$uid = intval($_POST['uid'] ?? 0);
$pid = intval($_POST['pid'] ?? 0);
$quantity = intval($_POST['quantity'] ?? 1);
$order_type = $_POST['order_type'] ?? '';

if (!$uid || !$pid || !$order_type) {
    echo json_encode(['success' => false, 'error' => 'Missing parameters']);
    exit;
}

/* --------------------------
   DETERMINE ORDER STATUS
-------------------------- */
$status = 'reserved'; // default for customer purchase

if ($order_type === 'donation') {
    $status = 'unclaimed'; // donation becomes unclaimed inventory
}
if ($order_type === 'needy_pickup') {
    $status = 'picked_up';
}

/* --------------------------
   VERIFY QUANTITY AVAILABLE
-------------------------- */
$sql = "
    SELECT 
        p.quantity - COALESCE(SUM(o.quantity), 0) AS available_quantity
    FROM plates p
    LEFT JOIN orders o 
        ON p.pid = o.plate_id
        AND o.order_status IN ('unclaimed', 'reserved', 'picked_up')
    WHERE p.pid = ?
    GROUP BY p.pid
";

$stmt = $mysqli->prepare($sql);
$stmt->bind_param("i", $pid);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();

if (!$row) {
    echo json_encode(['success' => false, 'error' => 'Plate not found']);
    exit;
}

$available = intval($row['available_quantity']);

if ($available < $quantity) {
    echo json_encode(['success' => false, 'error' => "Only $available plates left"]);
    exit;
}

/* --------------------------
   INSERT THE ORDER
-------------------------- */
$stmt = $mysqli->prepare("
    INSERT INTO orders (user_id, plate_id, quantity, order_type, order_status)
    VALUES (?, ?, ?, ?, ?)
");

$stmt->bind_param("iiiss", $uid, $pid, $quantity, $order_type, $status);

if (!$stmt->execute()) {
    echo json_encode(['success' => false, 'error' => 'Failed to create order']);
    exit;
}

echo json_encode(['success' => true]);
