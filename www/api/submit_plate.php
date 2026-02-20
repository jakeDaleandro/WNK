<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

$uid         = $_POST['uid'] ?? '';
$price       = $_POST['price'] ?? '';
$quantity    = $_POST['quantity'] ?? '';
$description = $_POST['description'] ?? '';
$etime = $_POST['etime'] ?? '';

if (!$uid || !$price || !$quantity || !$description || !$etime) {
    echo json_encode(["error" => "All fields required"]);
    exit();
}

$stmt = $mysqli->prepare("INSERT INTO plates (rid, price, quantity, etime, description) VALUES (?, ?, ?, ?, ?)");

$price = (float)$price;
$quantity = (int)$quantity;

$stmt->bind_param(
    "idiss",
    $uid,
    $price,
    $quantity,
    $etime,
    $description
);

if (!$stmt->execute()) {
    echo json_encode(["error" => "SQL execution failed: " . $stmt->error]);
    exit();
} else {
    echo json_encode([
        "success" => true,
    ]);
}

$stmt->close();
$mysqli->close();
