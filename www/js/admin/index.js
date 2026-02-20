import { getCookie, eraseCookie } from "../../js/utils.js";

const uid = getCookie("uid");
if (uid === null) {
  window.location.href = "/";
}

try {
  const response = await fetch(`../api/get_user.php?uid=${uid}`);
  const data = await response.json();

  if (data.success) {
    if (data.user.role !== "admin") {
      window.location.href = "/";
    }
  }

  document.getElementById("adminName").textContent = data.user.name;
} catch (err) {
  console.error("Failed to fetch user data:", err);
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.href = "/";
});

try {
  const response = await fetch("../api/admin/dashboard_stats.php");
  const data = await response.json();

  if (data.success) {
    const stats = data.stats;
    document.getElementById("statsGrid").innerHTML = `
      <div class="stat-card">
        <h3>Total Users</h3>
        <p class="stat-number">${stats.total_users}</p>
      </div>
      <div class="stat-card">
        <h3>Restaurants</h3>
        <p class="stat-number">${stats.total_restaurants}</p>
      </div>
      <div class="stat-card">
        <h3>Active Plates</h3>
        <p class="stat-number">${stats.active_plates}</p>
      </div>
      <div class="stat-card">
        <h3>Today's Orders</h3>
        <p class="stat-number">${stats.today_orders}</p>
      </div>
    `;
  } else {
    document.getElementById("statsGrid").innerHTML = "<p>Error loading statistics</p>";
  }
} catch (error) {
  console.error("Error loading dashboard:", error);
  document.getElementById("statsGrid").innerHTML = "<p>Error loading dashboard data</p>";
}

