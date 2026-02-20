<?php

header('Content-Type: application/json');

try {

    /** @var mysqli $mysqli */
    require_once '/var/www/src/db.php';

    $role = $_POST['role'] ?? '';
    $name = $_POST['name'] ?? '';
    $address = $_POST['address'] ?? '';
    $phone = $_POST['phone'] ?? '';
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    $ccn = $_POST['ccn'] ?? '';
    $cem = $_POST['expMonth'] ?? '';
    $cey = $_POST['expYear'] ?? '';
    $cvv = $_POST['cvv'] ?? '';

    if ((!$role || !$name || !$address || !$username || !$password) ||
    (($role != "needy") && !$phone) ||
    (($role == "customer" || $role == "donor") && (!$ccn || !$cem || !$cey || !$cvv))) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    $stmt = $mysqli->prepare("SELECT uid FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        echo json_encode(['success' => false, 'error' => 'Username already exists']);
        exit;
    }


    $piid = null;
    if ($role == "customer" || $role == "donor") {
        $stmt = $mysqli->prepare("INSERT INTO payment_info (cc_number, cc_exp_month, cc_exp_year, cc_cvv) VALUES (?, ?, ?, ?)");
        $monthInt = (int)substr($cem, 0, 2);
        $yearInt = (int)$cey;
        $stmt->bind_param("siis", $ccn, $monthInt, $yearInt, $cvv);
        if (!$stmt->execute()) {
            echo json_encode(['success' => false, 'error' => $stmt->error]);
            exit;
        }
        $piid = $mysqli->insert_id;
    }

    $salt = bin2hex(random_bytes(16));
    $password_hash = hash('sha256', $password . $salt);

    $stmt = $mysqli->prepare(
        "INSERT INTO users (role, name, address, phone, username, password_hash, password_salt, piid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("sssssssi", $role, $name, $address, $phone, $username, $password_hash, $salt, $piid);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'User registered successfully']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to register user']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
