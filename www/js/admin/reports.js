import { getCookie, eraseCookie } from "../utils.js";

const uid = getCookie("uid");
if (uid === null) {
  window.location.href = "/";
}

// Verify admin role
try {
  const response = await fetch(`../api/get_user.php?uid=${uid}`);
  const data = await response.json();

  if (data.success) {
    if (data.user.role !== "admin") {
      window.location.href = "/";
    }
  } else {
    window.location.href = "/";
  }
} catch (err) {
  console.error("Failed to fetch user data:", err);
  window.location.href = "/";
}

// Logout functionality
document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.href = "/";
});

// Report generation
document.getElementById("generateReportBtn").addEventListener("click", generateReport);

async function generateReport() {
  const reportType = document.getElementById("reportType").value;
  const year = document.getElementById("reportYear").value;
  const userId = document.getElementById("userId").value;
  
  if (!reportType || !userId) {
    alert("Please select a report type and enter a user ID");
    return;
  }
  
  const resultsDiv = document.getElementById("reportResults");
  resultsDiv.innerHTML = "<p>Generating report...</p>";
  
  try {
    const response = await fetch(`../api/get_reports.php?type=${reportType}&year=${year}&user_id=${userId}`);
    const data = await response.json();
    
    if (data.success) {
      displayReportResults(data.data, reportType);
    } else {
      resultsDiv.innerHTML = `<p>Error: ${data.error}</p>`;
    }
  } catch (error) {
    console.error("Error generating report:", error);
    resultsDiv.innerHTML = "<p>Error generating report</p>";
  }
}

function displayReportResults(data, reportType) {
  const resultsDiv = document.getElementById("reportResults");
  
  if (data.length === 0) {
    resultsDiv.innerHTML = "<p>No data found for the selected criteria.</p>";
    return;
  }
  
  let html = `<h3>Report Results</h3>`;
  
  switch (reportType) {
    case 'restaurant_activity':
      html += generateRestaurantActivityTable(data);
      break;
    case 'customer_purchase':
      html += generateCustomerPurchaseTable(data);
      break;
    case 'needy_receipt':
      html += generateNeedyReceiptTable(data);
      break;
    case 'donor_tax':
      html += generateDonorTaxTable(data);
      break;
    default:
      html += '<p>Unknown report type</p>';
  }
  
  resultsDiv.innerHTML = html;
}

function generateRestaurantActivityTable(data) {
  let totalRevenue = 0;
  let totalQuantity = 0;
  
  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%;">
      <tr>
        <th>Plate Name</th>
        <th>Orders Count</th>
        <th>Total Quantity</th>
        <th>Total Revenue</th>
      </tr>
  `;
  
  data.forEach(row => {
    totalRevenue += parseFloat(row.total_revenue) || 0;
    totalQuantity += parseInt(row.total_quantity) || 0;
    
    html += `
      <tr>
        <td>${row.plate_name}</td>
        <td>${row.orders_count}</td>
        <td>${row.total_quantity}</td>
        <td>$${parseFloat(row.total_revenue).toFixed(2)}</td>
      </tr>
    `;
  });
  
  html += `
      <tr style="font-weight: bold; background: #f0f0f0;">
        <td colspan="2">TOTALS</td>
        <td>${totalQuantity}</td>
        <td>$${totalRevenue.toFixed(2)}</td>
      </tr>
    </table>
  `;
  
  return html;
}

function generateCustomerPurchaseTable(data) {
  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%;">
      <tr>
        <th>Date</th>
        <th>Plate Description</th>
        <th>Restaurant</th>
        <th>Quantity</th>
        <th>Amount</th>
      </tr>
  `;
  
  data.forEach(row => {
    html += `
      <tr>
        <td>${new Date(row.order_date).toLocaleDateString()}</td>
        <td>${row.description}</td>
        <td>${row.restaurant_name}</td>
        <td>${row.quantity}</td>
        <td>$${parseFloat(row.amount).toFixed(2)}</td>
      </tr>
    `;
  });
  
  html += `</table>`;
  return html;
}

function generateNeedyReceiptTable(data) {
  let totalPlates = 0;
  
  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%;">
      <tr>
        <th>Date</th>
        <th>Plate Description</th>
        <th>Restaurant</th>
        <th>Quantity</th>
      </tr>
  `;
  
  data.forEach(row => {
    totalPlates += parseInt(row.quantity) || 0;
    
    html += `
      <tr>
        <td>${new Date(row.order_date).toLocaleDateString()}</td>
        <td>${row.description}</td>
        <td>${row.restaurant_name}</td>
        <td>${row.quantity}</td>
      </tr>
    `;
  });
  
  html += `
      <tr style="font-weight: bold; background: #f0f0f0;">
        <td colspan="3">Total Plates Received</td>
        <td>${totalPlates}</td>
      </tr>
    </table>
  `;
  
  return html;
}

function generateDonorTaxTable(data) {
  let totalDonation = 0;
  
  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%;">
      <tr>
        <th>Date</th>
        <th>Plate Description</th>
        <th>Restaurant</th>
        <th>Quantity</th>
        <th>Amount</th>
        <th>Recipient</th>
      </tr>
  `;
  
  data.forEach(row => {
    totalDonation += parseFloat(row.donation_amount) || 0;
    
    html += `
      <tr>
        <td>${new Date(row.order_date).toLocaleDateString()}</td>
        <td>${row.description}</td>
        <td>${row.restaurant_name}</td>
        <td>${row.quantity}</td>
        <td>$${parseFloat(row.donation_amount).toFixed(2)}</td>
        <td>${row.recipient_name}</td>
      </tr>
    `;
  });
  
  html += `
      <tr style="font-weight: bold; background: #f0f0f0;">
        <td colspan="4">Total Donations</td>
        <td>$${totalDonation.toFixed(2)}</td>
        <td></td>
      </tr>
    </table>
  `;
  
  return html;
}