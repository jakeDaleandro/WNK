import { getCookie } from "./utils.js";

// ============================================================
// GLOBAL SETUP
// ============================================================

const uid = getCookie("uid");
console.log("Current Logged-in UID:", uid);

const availableList = document.getElementById("platesList");
const myOrders = document.getElementById("myOrders");

let availableDonations = [];


// ============================================================
// CLAIM DONATION
// ============================================================

window.claimDonation = async oid => {
    if (!uid) {
        alert("User not logged in or UID cookie missing.");
        return;
    }

    try {
        const resp = await fetch("../api/claim_donation.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid, oid })
        });

        const raw = await resp.text();
        console.log("RAW CLAIM RESPONSE:", raw);

        const result = JSON.parse(raw);

        alert(result.success ? "Reserved successfully! Check My Orders." : `Claim failed: ${result.error}`);

        loadAvailable();
        loadMyOrders();

    } catch (err) {
        console.error("Claim error:", err);
        alert("Error contacting server for claim operation.");
    }
};



// ============================================================
// LOAD AVAILABLE DONATIONS
// ============================================================

async function loadAvailable() {
    if (!uid) {
        availableList.innerHTML = "<p>Please log in to see available donations.</p>";
        return;
    }

    try {
        const resp = await fetch(`../api/get_plates.php?uid=${uid}`);
        const result = await resp.json();

        if (!result.success) {
            availableList.innerHTML = "<p>Error loading donations.</p>";
            return;
        }

        availableDonations = result.plates;

        if (availableDonations.length === 0) {
            availableList.innerHTML = "<p>No available donations right now.</p>";
            return;
        }

        availableList.innerHTML = availableDonations
            .map(p => `
                <div style="padding: 8px; border:1px solid #ccc; margin-bottom:6px;">
                    <strong>${p.description}</strong><br>
                    Restaurant: ${p.restaurant_name}<br>
                    Quantity Available: ${p.quantity}<br>
                    Expires: ${p.etime}
                    <br><br>
                    <button class="claim-btn" data-oid="${p.oid}">Claim</button>
                </div>
            `)
            .join("");

        document.querySelectorAll(".claim-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const oid = btn.dataset.oid;
                window.claimDonation(oid);
            });
        });

    } catch (err) {
        console.error(err);
        availableList.innerHTML = "<p>Failed to load donation plates.</p>";
    }
}



// ============================================================
// NEEDY USER ORDER ACTIONS
// ============================================================

/**
 * Cancel a donation:
 * - Set needy_id = NULL
 * - Set order_status = 'unclaimed'
 * - Does NOT modify plate quantity
 */
window.cancelDonation = async (oid, pid, quantity) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;

    const resp = await fetch("../api/update_donation_status.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            uid,
            oid,
            pid,
            quantity,
            action: "cancel_needy"
        })
    });

    const result = await resp.json();
    alert(result.success ? "Order canceled." : result.error);

    loadAvailable();
    loadMyOrders();
};


/**
 * Mark donation as picked up
 */
window.pickupDonation = async (oid) => {
    const resp = await fetch("../api/update_donation_status.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            uid,
            oid,
            action: "pickup"
        })
    });

    const result = await resp.json();
    alert(result.success ? "Marked as picked up!" : result.error);

    loadAvailable();
    loadMyOrders();
};


// ============================================================
// LOAD NEEDY USER'S CLAIMED ORDERS
// ============================================================

async function loadMyOrders() {
    if (!uid) {
        myOrders.innerHTML = "<p>Please log in to see your claimed orders.</p>";
        return;
    }

    try {
        const resp = await fetch(`../api/get_orders.php?uid=${uid}`);
        const result = await resp.json();

        if (!result.success) {
            myOrders.innerHTML = "<p>Error loading your orders.</p>";
            return;
        }

        const orders = result.orders;

        if (!orders || orders.length === 0) {
            myOrders.innerHTML = "<p>You have no active claimed plates.</p>";
            return;
        }

        myOrders.innerHTML = orders
            .map(o => `
                <div style="padding:8px; border:1px solid #ddd; margin-bottom:6px;">
                    <strong>${o.description}</strong><br>
                    Status: <strong>${o.order_status}</strong><br>
                    Quantity: ${o.quantity}<br>
                    Expires: ${o.etime}<br><br>

                    ${
                        o.order_status === "reserved"
                            ? `
                                <button onclick="pickupDonation(${o.oid})">Mark Picked Up</button>
                                <button onclick="cancelDonation(${o.oid}, ${o.pid}, ${o.quantity})"
                                    style="margin-left:10px; color:red;">
                                    Cancel
                                </button>
                              `
                            : `<em>Picked Up</em>`
                    }
                </div>
            `)
            .join("");

    } catch (err) {
        console.error(err);
        myOrders.innerHTML = "<p>Failed to load your orders.</p>";
    }
}



// ============================================================
// INITIAL LOAD
// ============================================================

loadAvailable();
loadMyOrders();
