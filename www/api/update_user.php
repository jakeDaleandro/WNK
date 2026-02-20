<?php

header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

$uid = intval($_POST['uid'] ?? 0);
$name = $_POST['name'] ?? '';
$address = $_POST['address'] ?? '';
$phone = $_POST['phone'] ?? '';
$password = $_POST['password'] ?? '';

$stmt = $mysqli->prepare("SELECT role, piid FROM users WHERE uid = ?");
$stmt->bind_param("i", $uid);
$stmt->execute();
$stmt->bind_result($role, $piid);
$stmt->fetch();
$stmt->close();

if (!$role) {
    echo json_encode(["success" => false, "error" => "user_not_found"]);
    exit();
}

if ($password) {
    $salt = bin2hex(random_bytes(16));
    $hash = hash('sha256', $password . $salt);

    $stmt = $mysqli->prepare("UPDATE users SET name=?, address=?, phone=?, password_hash=?, password_salt=? WHERE uid=?");
    $stmt->bind_param("sssssi", $name, $address, $phone, $hash, $salt, $uid);
} else {
    $stmt = $mysqli->prepare("UPDATE users SET name=?, address=?, phone=? WHERE uid=?");
    $stmt->bind_param("sssi", $name, $address, $phone, $uid);
}

$stmt->execute();
$stmt->close();

if ($role === "customer" || $role === "donor") {
    $cc_number = $_POST['cc_number'] ?? '';
    $cc_exp_month = $_POST['cc_exp_month'] ?? null;
    $cc_exp_year = $_POST['cc_exp_year'] ?? null;
    $cc_cvv = $_POST['cc_cvv'] ?? '';

    if ($piid) {
        $stmt = $mysqli->prepare("
            UPDATE payment_info
            SET cc_number=?, cc_exp_month=?, cc_exp_year=?, cc_cvv=?
            WHERE piid=?
        ");
        $stmt->bind_param("siisi", $cc_number, $cc_exp_month, $cc_exp_year, $cc_cvv, $piid);
        $stmt->execute();
        $stmt->close();
    } elseif ($cc_number && $cc_exp_month && $cc_exp_year && $cc_cvv) {
        $stmt = $mysqli->prepare("
            INSERT INTO payment_info (cc_number, cc_exp_month, cc_exp_year, cc_cvv)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->bind_param("siis", $cc_number, $cc_exp_month, $cc_exp_year, $cc_cvv);
        $stmt->execute();
        $new_piid = $stmt->insert_id;
        $stmt->close();

        $stmt = $mysqli->prepare("UPDATE users SET piid=? WHERE uid=?");
        $stmt->bind_param("ii", $new_piid, $uid);
        $stmt->execute();
        $stmt->close();
    }
}

echo json_encode(["success" => true]);
