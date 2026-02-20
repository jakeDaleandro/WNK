<?php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once '/var/www/src/db.php';

$report_type = $_GET['type'] ?? '';
$year = $_GET['year'] ?? date('Y');
$user_id = $_GET['user_id'] ?? '';

if (!$report_type || !$user_id) {
    echo json_encode(['success' => false, 'error' => 'Missing report type or user ID']);
    exit;
}

try {
    switch ($report_type) {
        case 'restaurant_activity':
            // Restaurant activity report - shows plates owned by the restaurant and their orders
            $stmt = $mysqli->prepare("
                SELECT p.description as plate_name, 
                       COUNT(o.oid) as orders_count, 
                       SUM(o.quantity) as total_quantity,
                       SUM(o.quantity * p.price) as total_revenue
                FROM orders o
                JOIN plates p ON o.plate_id = p.pid
                WHERE p.rid = ? AND YEAR(o.order_date) = ?
                GROUP BY p.pid, p.description
            ");
            $stmt->bind_param("ii", $user_id, $year);
            break;
            
        case 'customer_purchase':
            // Customer purchase history
            $stmt = $mysqli->prepare("
                SELECT o.order_date, p.description, r.name as restaurant_name, 
                       o.quantity, (o.quantity * p.price) as amount,
                       o.order_status
                FROM orders o
                JOIN plates p ON o.plate_id = p.pid
                JOIN users r ON p.rid = r.uid
                WHERE o.user_id = ? AND YEAR(o.order_date) = ? AND o.order_type = 'purchase'
                ORDER BY o.order_date DESC
            ");
            $stmt->bind_param("ii", $user_id, $year);
            break;
            
        case 'needy_receipt':
            // Needy user pickup history
            $stmt = $mysqli->prepare("
                SELECT o.order_date, p.description, r.name as restaurant_name, 
                       o.quantity, o.order_status
                FROM orders o
                JOIN plates p ON o.plate_id = p.pid
                JOIN users r ON p.rid = r.uid
                WHERE o.user_id = ? AND YEAR(o.order_date) = ? AND o.order_type = 'needy_pickup'
                ORDER BY o.order_date DESC
            ");
            $stmt->bind_param("ii", $user_id, $year);
            break;
            
        case 'donor_tax':
            // Donor tax receipt - donation history
            $stmt = $mysqli->prepare("
                SELECT o.order_date, p.description, r.name as restaurant_name, 
                       o.quantity, (o.quantity * p.price) as donation_amount,
                       o.order_status,
                       'Food Bank Charity' as recipient_name
                FROM orders o
                JOIN plates p ON o.plate_id = p.pid
                JOIN users r ON p.rid = r.uid
                WHERE o.user_id = ? AND YEAR(o.order_date) = ? AND o.order_type = 'donation'
                ORDER BY o.order_date DESC
            ");
            $stmt->bind_param("ii", $user_id, $year);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Invalid report type']);
            exit;
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data,
        'report_type' => $report_type,
        'year' => $year,
        'user_id' => $user_id
    ]);
    
    $stmt->close();
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>