import { getCookie, eraseCookie } from "./utils.js";

const uid = getCookie("uid");
if (uid === null) {
  window.location.href = "/";
}

try {
  const response = await fetch(`../api/get_user.php?uid=${uid}`);
  const data = await response.json();
  if (data.success) {
    if (data.user.role !== "restaurant") {
      window.location.href = "/";
    }
  }
} catch (err) {
  console.error("Failed to fetch user data:", err);
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.href = "/";
});

document
  .getElementById("listPlateForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    formData.append("uid", uid);

    // Convert local date and time to UTC
    const localDate = formData.get("endDate");
    const localTime = formData.get("endTime");
    const localDateTime = new Date(`${localDate}T${localTime}:00`);
    const utcString = localDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    formData.delete("endDate");
    formData.delete("endTime");
    formData.append("etime", utcString);

    const res = await fetch("../api/submit_plate.php", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    console.log(data);

    if (data.success) {
      alert("Plate added!");
      location.reload();
    } else {
      alert("Error: " + data.error);
    }
  });

try {
  const res = await fetch(`../api/get_restaurant_plates.php?uid=${uid}`);
  const data = await res.json();
  const table = document.getElementById("availablePlatesTbl");

  if (data.success && data.plates.length > 0) {
    data.plates.forEach((plate) => {
      const row = table.insertRow();
      row.insertCell(0).textContent = plate.pid;
      row.insertCell(1).textContent = plate.description;
      row.insertCell(2).textContent = plate.price.toFixed(2);
      row.insertCell(3).textContent = plate.available_quantity;

      const utcDate = new Date(plate.etime + "Z");
      const localDateStr = utcDate.toLocaleString();
      row.insertCell(4).textContent = localDateStr;
    });
  } else {
    const row = table.insertRow();
    const cell = row.insertCell(0);
    cell.colSpan = 5;
    cell.textContent = "No available plates";
    cell.style.textAlign = "center";
  }
} catch (err) {
  console.error("Failed to load available plates:", err);
}

try {
  const res = await fetch(`../api/get_restaurant_orders.php?uid=${uid}`);
  const data = await res.json();
  const table = document.getElementById("ordersTbl");

  if (data.success && data.orders.length > 0) {
    data.orders.forEach((order) => {
      const row = table.insertRow();

      row.insertCell(0).textContent = order.oid;
      row.insertCell(1).textContent = order.name;
      row.insertCell(2).textContent = Number(order.price).toFixed(2);
      row.insertCell(3).textContent = order.quantity;
      row.insertCell(4).textContent = order.description;
      row.insertCell(5).textContent = order.purchased_by;
      row.insertCell(6).textContent = order.pickup_name ?? "";
    });
  } else {
    const row = table.insertRow();
    const cell = row.insertCell(0);
    cell.colSpan = 7;
    cell.textContent = "No orders found";
    cell.style.textAlign = "center";
  }
} catch (err) {
  console.error("Failed to load orders:", err);
}
