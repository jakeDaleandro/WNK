import { getCookie } from "./utils.js";

const uid = getCookie("uid");
const platesList = document.getElementById("platesList");
const myOrders = document.getElementById("myOrders");
const pastOrders = document.getElementById("pastOrders");

let plates = [];

/* ============================================================
   Quantity adjustment
   ============================================================ */
function changeQty(pid, delta) {
    const qtyEl = document.getElementById(`qty-${pid}`);
    if (!qtyEl) return;

    let current = parseInt(qtyEl.innerText || "1", 10);
    if (Number.isNaN(current)) current = 1;

    const plate = plates.find(p => Number(p.pid) === Number(pid));
    if (!plate) return;

    const available = parseInt(plate.available_quantity ?? plate.quantity ?? 1, 10) || 1;

    let updated = current + delta;
    if (updated < 1) updated = 1;
    if (updated > available) updated = available;

    qtyEl.innerText = String(updated);
}

window.changeQty = changeQty;

/* ============================================================
   Load Available Plates
   ============================================================ */
async function loadPlates() {
    const resp = await fetch(`../api/get_plates.php?uid=${uid}`);
    const result = await resp.json();

    if (!result.success) {
        platesList.innerHTML = `<p>Error loading plates</p>`;
        return;
    }

    plates = result.plates;

    platesList.innerHTML = plates.map(plate => {
        const available = plate.available_quantity ?? plate.quantity;
        return `
            <div style="padding:8px;border:1px solid #ccc;margin:6px 0;">
                <strong>${plate.description}</strong> — $${plate.price}<br>
                Restaurant: ${plate.restaurant_name}<br>
                Available: ${available}<br>
                Expires: ${plate.etime}<br><br>

                <button onclick="changeQty(${plate.pid}, -1)">-</button>
                <span id="qty-${plate.pid}">1</span>
                <button onclick="changeQty(${plate.pid}, 1)">+</button>

                <button style="margin-left:10px" onclick="reservePlate(${plate.pid})">
                    Reserve
                </button>
            </div>
        `;
    }).join("");
}

/* ============================================================
   Reserve Plate
   ============================================================ */
window.reservePlate = async pid => {
    const qtyEl = document.getElementById(`qty-${pid}`);
    let quantity = parseInt(qtyEl.innerText, 10);

    const resp = await fetch("../api/order_plate.php", {
        method: "POST",
        body: new URLSearchParams({ uid, pid, quantity, order_type: "purchase" })
    });

    const result = await resp.json();
    alert(result.success ? "Reserved!" : result.error);

    loadPlates();
    loadOrders();
    loadPastOrders();
};

/* ============================================================
   Order Actions
   ============================================================ */
window.customerCancel = async (oid, pid, quantity) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    const resp = await fetch("../api/update_donation_status.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            uid,
            oid,
            pid,
            quantity,
            action: "cancel_customer"
        })
    });

    const result = await resp.json();
    alert(result.success ? "Order cancelled." : result.error);

    loadPlates();
    loadOrders();
    loadPastOrders();
};

window.customerPickup = async (oid) => {
    const resp = await fetch("../api/update_donation_status.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            uid,
            oid,
            action: "pickup_customer"
        })
    });

    const result = await resp.json();
    alert(result.success ? "Marked as picked up." : result.error);

    loadOrders();
    loadPastOrders();
};

/* ============================================================
   Load Active Orders
   ============================================================ */
async function loadOrders() {
    const resp = await fetch(`../api/get_orders.php?uid=${uid}`);
    const result = await resp.json();

    if (!result.success) {
        myOrders.innerHTML = "<p>Error loading orders.</p>";
        return;
    }

    const active = result.orders.filter(o => 
        o.order_status === "reserved"
    );

    if (active.length === 0) {
        myOrders.innerHTML = "<p>No active orders.</p>";
        return;
    }

    myOrders.innerHTML = active.map(o => `
        <div style="padding:8px;border:1px solid #ddd;margin:6px 0;">
            <strong>${o.description}</strong><br>
            Quantity: ${o.quantity}<br>
            Status: ${o.order_status}<br><br>

            <button onclick="customerPickup(${o.oid})">Picked Up</button>
            <button onclick="customerCancel(${o.oid}, ${o.pid}, ${o.quantity})" style="color:red;margin-left:10px;">
                Cancel
            </button>
        </div>
    `).join("");
}

/* ============================================================
   Load Past Orders
   ============================================================ */
async function loadPastOrders() {
    const resp = await fetch(`../api/get_orders.php?uid=${uid}`);
    const result = await resp.json();

    if (!result.success) {
        pastOrders.innerHTML = "<p>Error loading past orders.</p>";
        return;
    }

    const past = result.orders.filter(o =>
        o.order_status === "picked_up" ||
        o.order_status === "cancelled"
    );

    if (past.length === 0) {
        pastOrders.innerHTML = "<p>No past orders.</p>";
        return;
    }

    pastOrders.innerHTML = past.map(o => `
        <div style="padding:8px;border:1px solid #ddd;margin:6px 0;">
            <strong>${o.description}</strong><br>
            Quantity: ${o.quantity}<br>
            Status: <strong>${o.order_status}</strong>
        </div>
    `).join("");
}

/* ============================================================
   INITIAL LOAD
   ============================================================ */
loadPlates();
loadOrders();
loadPastOrders();
