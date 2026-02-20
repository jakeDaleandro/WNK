import { getCookie, eraseCookie } from "./utils.js";

const uid = getCookie("uid");
if (!uid) window.location.href = "/";

document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.href = "/";
});

async function loadUser() {
  try {
    const res = await fetch(`../api/get_user.php?uid=${uid}`);
    const data = await res.json();

    if (!data.success) return;

    const user = data.user;

    document.querySelector("input[name='role']").value = user.role;
    document.querySelector("input[name='name']").value = user.name;
    document.querySelector("input[name='address']").value = user.address;
    document.querySelector("input[name='phone']").value = user.phone ?? "";
    document.querySelector("input[name='username']").value = user.username;

    if (user.role === "customer" || user.role === "donor") {
      document.getElementById("paymentFields").style.display = "block";
      if (user.payment_info) {
        document.querySelector("input[name='cc_number']").value =
          user.payment_info.cc_number;
        document.querySelector("input[name='cc_exp_month']").value =
          user.payment_info.cc_exp_month;
        document.querySelector("input[name='cc_exp_year']").value =
          user.payment_info.cc_exp_year;
        document.querySelector("input[name='cc_cvv']").value =
          user.payment_info.cc_cvv;
      }
    }
  } catch (err) {
    console.error("Failed to load user info:", err);
  }
}

loadUser();

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  formData.append("uid", uid);

  try {
    const res = await fetch("../api/update_user.php", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      alert("Profile updated successfully!");
      loadUser();
      e.target.reset();
    } else {
      alert("Error: " + data.error);
    }
  } catch (err) {
    console.error("Failed to update user info:", err);
  }
});
