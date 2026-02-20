import { getCookie, eraseCookie } from "../utils.js";

const uid = getCookie("uid");
if (uid === null) {
  window.location.href = "/";
}

// Verification
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

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  eraseCookie("uid");
  window.location.href = "/";
});

// Member search
document.getElementById("searchBtn").addEventListener("click", searchMembers);

async function searchMembers() {
  const searchTerm = document.getElementById("searchInput").value;
  const roleFilter = document.getElementById("roleFilter").value;
  
  try {
    const response = await fetch(`../api/get_members.php?search=${encodeURIComponent(searchTerm)}&role=${roleFilter}`);
    const data = await response.json();
    
    if (data.success) {
      displayMembers(data.users);
    } else {
      document.getElementById("membersResults").innerHTML = "<p>Error searching members</p>";
    }
  } catch (error) {
    console.error("Error searching members:", error);
    document.getElementById("membersResults").innerHTML = "<p>Error searching members</p>";
  }
}

function displayMembers(users) {
  const resultsDiv = document.getElementById("membersResults");
  
  if (users.length === 0) {
    resultsDiv.innerHTML = "<p>No members found.</p>";
    return;
  }
  
  let html = "<table border='1' style='border-collapse: collapse; width: 100%;'><tr><th>ID</th><th>Name</th><th>Role</th><th>Username</th><th>Address</th><th>Phone</th></tr>";
  
  users.forEach(user => {
    html += `<tr>
      <td>${user.uid}</td>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.username}</td>
      <td>${user.address}</td>
      <td>${user.phone || 'N/A'}</td>
    </tr>`;
  });
  
  html += "</table>";
  resultsDiv.innerHTML = html;
}

searchMembers();