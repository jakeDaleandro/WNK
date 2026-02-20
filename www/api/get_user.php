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

$uid = intval($_GET['uid']); // sanitize

$stmt = $mysqli->prepare("SELECT uid, role, name, address, phone, username FROM users WHERE uid = ?");
$stmt->bind_param("i", $uid);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    echo json_encode([
        'success' => true,
        'user' => $user
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'User not found'
    ]);
}

$stmt->close();
$mysqli->close();
