import { getCookie, eraseCookie } from "./utils.js";

const uid = getCookie("uid");
const loggedIn = uid !== null;

if (loggedIn) {
  document.getElementById("loggedOutUI").style.display = "none";
  try {
    const response = await fetch(`../api/get_user.php?uid=${uid}`);
    const data = await response.json();

    if (data.success) {
      document.getElementById("welcomeMsg").textContent =
        `Welcome, ${data.user.name}`;
      const viewRolePageBtn = document.getElementById("viewRolePageBtn");
      let rolePageHref;
      switch (data.user.role) {
        case "restaurant":
          rolePageHref = "restaurant.html";
          viewRolePageBtn.textContent = "Restraurant View";
          break;
        case "customer":
          rolePageHref = "customer.html";
          viewRolePageBtn.textContent = "Customer View";
          break;
        case "donor":
          rolePageHref = "donor.html";
          viewRolePageBtn.textContent = "Donor View";
          break;
        case "needy":
          rolePageHref = "needy.html";
          viewRolePageBtn.textContent = "Needy View";
          break;
        case "admin":
          viewRolePageBtn.textContent = "Admin Dashboard";
          rolePageHref = "admin/index.html";
          break;
      }
      viewRolePageBtn.addEventListener("click", () => {
        window.location.href = rolePageHref;
      });
    } else {
      console.error("Error while fetching user data:", data.error);
    }
  } catch (err) {
    console.error("Failed to fetch user data:", err);
  }
} else {
  document.getElementById("loggedInUI").style.display = "none";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.reload();
});
