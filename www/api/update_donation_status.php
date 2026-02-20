<?php
header('Content-Type: application/json');
require_once '/var/www/src/db.php';

$uid = intval($_POST['uid'] ?? 0);
$oid = intval($_POST['oid'] ?? 0);
$pid = intval($_POST['pid'] ?? 0);
$action = $_POST['action'] ?? '';

if (!$uid || !$oid || !$action) {
    echo json_encode(["success" => false, "error" => "Missing parameters."]);
    exit();
}

// Fetch the order details from DB
$stmt = $mysqli->prepare("
    SELECT order_type, order_status, quantity, plate_id, needy_id
    FROM orders
    WHERE oid = ?
");
$stmt->bind_param("i", $oid);
$stmt->execute();
$stmt->bind_result($order_type, $order_status, $quantity, $plate_id, $needy_id);
if (!$stmt->fetch()) {
    echo json_encode(["success" => false, "error" => "Order not found."]);
    $stmt->close();
    exit();
}
$stmt->close();

// CUSTOMER ACTIONS
if ($action === 'cancel_customer') {
    // Validate order type
    if ($order_type !== 'purchase') {
        echo json_encode(["success" => false, "error" => "Invalid order type for customer."]);
        exit();
    }

    // Validate order status
    if ($order_status !== 'reserved') {
        echo json_encode(["success" => false, "error" => "Only reserved orders can be cancelled."]);
        exit();
    }

    // Step 1: Get the plate_id from the order (already in $plate_id)
    // Step 2: Increment the plate's quantity by exactly the order's quantity
    // $stmt = $mysqli->prepare("UPDATE plates SET quantity = quantity + ? WHERE pid = ?");
    // $stmt->bind_param("ii", $quantity, $plate_id);
    // $stmt->execute();
    // $stmt->close();

    // Step 3: Update the order to 'cancelled'
    $stmt = $mysqli->prepare("UPDATE orders SET order_status = 'cancelled' WHERE oid = ?");
    $stmt->bind_param("i", $oid);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => true]);
    exit();
}



if ($action === 'pickup_customer') {
    if ($order_type !== 'purchase') {
        echo json_encode(["success" => false, "error" => "Invalid order type for customer."]);
        exit();
    }
    if ($order_status !== 'reserved') {
        echo json_encode(["success" => false, "error" => "Only reserved orders can be marked picked up."]);
        exit();
    }

    $stmt = $mysqli->prepare("UPDATE orders SET order_status = 'picked_up' WHERE oid = ?");
    $stmt->bind_param("i", $oid);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => true]);
    exit();
}

// NEEDY ACTIONS (optional, if same file handles needy)
if ($action === 'cancel_needy') {
    if ($order_type !== 'donation') {
        echo json_encode(["success" => false, "error" => "Invalid order type for needy."]);
        exit();
    }

    // Only reserved orders can be cancelled
    if ($order_status !== 'reserved') {
        echo json_encode(["success" => false, "error" => "Only reserved orders can be cancelled."]);
        exit();
    }

    $stmt = $mysqli->prepare("UPDATE orders SET needy_id = NULL, order_status = 'unclaimed' WHERE oid = ?");
    $stmt->bind_param("i", $oid);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => true]);
    exit();
}

// PICKUP_NEEDY (optional)
if ($action === 'pickup_needy') {
    if ($order_type !== 'donation') {
        echo json_encode(["success" => false, "error" => "Invalid order type for needy."]);
        exit();
    }

    $stmt = $mysqli->prepare("UPDATE orders SET order_status = 'picked_up' WHERE oid = ?");
    $stmt->bind_param("i", $oid);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => true]);
    exit();
}

echo json_encode(["success" => false, "error" => "Invalid action."]);
exit();
?>
