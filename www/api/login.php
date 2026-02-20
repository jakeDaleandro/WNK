<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

if (!$username || !$password) {
    echo json_encode(['success' => false, 'error' => 'Missing username or password']);
    exit;
}

$stmt = $mysqli->prepare("SELECT password_hash, password_salt, uid, name, role FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    $hash = $row['password_hash'];
    $salt = $row['password_salt'];

    $password_check = hash('sha256', $password . $salt);

    if (hash_equals($hash, $password_check)) {
        echo json_encode([
            'success' => true,
            'uid' => $row['uid'],
            'name' => $row['name'],
            'role' => $row['role']
        ]);
        exit;
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid username or password']);
        exit;
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid username or password']);
    exit;
}
