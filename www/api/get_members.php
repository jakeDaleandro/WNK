<?php
header('Content-Type: application/json');

/** @var mysqli $mysqli */
require_once '/var/www/src/db.php';

// Get query parameters
$search = $_GET['search'] ?? '';
$role = $_GET['role'] ?? '';

// Build SQL query
$sql = "SELECT uid, role, name, address, phone, username FROM users WHERE role != 'admin'";
$params = [];
$types = "";

if (!empty($search)) {
    $sql .= " AND (name LIKE ? OR username LIKE ? OR address LIKE ?)";
    $search_term = "%$search%";
    $params = array_merge($params, [$search_term, $search_term, $search_term]);
    $types .= "sss";
}

if (!empty($role) && $role != 'all') {
    $sql .= " AND role = ?";
    $params[] = $role;
    $types .= "s";
}

$sql .= " ORDER BY uid DESC";

$stmt = $mysqli->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$users = [];
while ($row = $result->fetch_assoc()) {
    $users[] = $row;
}

echo json_encode([
    'success' => true,
    'users' => $users
]);

$stmt->close();
?>