import { getCookie } from "./utils.js";

const uid = getCookie("uid");
const platesList = document.getElementById("platesList");
const myOrders = document.getElementById("myOrders");

// global plates list for changeQty
let plates = [];

// adjust donor quantity
window.changeQty = (pid, delta) => {
    const qtyEl = document.getElementById(`qty-${pid}`);
    if (!qtyEl) return;

    let current = parseInt(qtyEl.innerText) || 1;

    const plate = plates.find(p => Number(p.pid) === Number(pid));
    if (!plate) return;

    // donor logic uses available quantity from get_plates.php
    const maxQty = parseInt(plate.available_quantity ?? plate.quantity ?? 1);

    let updated = current + delta;

    if (updated < 1) updated = 1;
    if (updated > maxQty) updated = maxQty;

    qtyEl.innerText = updated;
};

async function loadPlates() {
    const resp = await fetch(`../api/get_plates.php?uid=${uid}`);
    const result = await resp.json();

    if (!result.success) {
        platesList.innerHTML = "<p>Error loading plates.</p>";
        return;
    }

    plates = result.plates;

    if (!plates || plates.length === 0) {
        platesList.innerHTML = "<p>No available plates.</p>";
        return;
    }

    platesList.innerHTML = plates
        .map(plate => {
            const available = plate.available_quantity ?? plate.quantity ?? 0;

            return `
            <div style="padding: 8px; border:1px solid #ccc; margin-bottom:6px;">
                <strong>${plate.description}</strong> — $${plate.price} 
                <br>Available until: ${plate.etime}
                <br>Restaurant: ${plate.restaurant_name}
                <br>Available: ${available}

                <br><br>

                <div class="qty-control" style="display:inline-flex; gap:8px; align-items:center;">
                    <button onclick="changeQty(${plate.pid}, -1)">-</button>
                    <span id="qty-${plate.pid}" class="qty-value" style="min-width:24px; text-align:center;">1</span>
                    <button onclick="changeQty(${plate.pid}, 1)">+</button>
                </div>

                <button style="margin-left:12px;" onclick="donatePlate(${plate.pid})">
                    Donate
                </button>
            </div>
            `;
        })
        .join("");
}

async function loadOrders() {
    const resp = await fetch(`../api/get_orders.php?uid=${uid}`);
    const result = await resp.json();

    if (!result.success) {
        myOrders.innerHTML = "<p>Error loading orders.</p>";
        return;
    }

    const orders = result.orders;

    if (!orders || orders.length === 0) {
        myOrders.innerHTML = "<p>You have no donation orders.</p>";
        return;
    }

    myOrders.innerHTML = orders
        .map(o => `
        <div style="padding:8px; border:1px solid #ddd; margin-bottom:6px;">
            Plate: <strong>${o.description}</strong><br>
            Status: ${o.order_status}<br>
            Quantity: ${o.quantity}
        </div>
    `)
        .join("");
}

window.donatePlate = async pid => {
    const qty = parseInt(document.getElementById(`qty-${pid}`).innerText) || 1;

    const resp = await fetch("../api/order_plate.php", {
        method: "POST",
        body: new URLSearchParams({
            uid,
            pid,
            quantity: qty,
            order_type: "donation"
        })
    });

    const result = await resp.json();
    alert(result.success ? "Donation submitted!" : result.error);

    loadPlates();
    loadOrders();
};

loadPlates();
loadOrders();
