let selectedRole;
document.getElementById("selectRoleBtn").addEventListener("click", () => {
  document.getElementById("selectRoleUI").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
  selectedRole = document.getElementById("roleSelect").value;
  document.getElementById("roleText").textContent =
    `Registering as ${selectedRole}`;
  if (["customer", "donor"].includes(selectedRole)) {
    document.getElementById("paymentInfo").style.display = "block";
    document.getElementById("selectExpMonth").setAttribute("required", "");
    document.getElementById("selectExpYear").setAttribute("required", "");
    document.getElementById("inputccn").setAttribute("required", "");
    document.getElementById("inputcvv").setAttribute("required", "");
  }
  if (["needy"].includes(selectedRole)) {
    document.getElementById("phoneInput").removeAttribute("required");
  }
});

const yearSelect = document.getElementById("selectExpYear");
const currentYear = new Date().getFullYear();
for (let i = 0; i < 15; i++) {
  const year = currentYear + i;
  const option = document.createElement("option");
  option.value = year;
  option.textContent = year;
  yearSelect.appendChild(option);
}

const message = document.getElementById("message");
const registerForm = document.getElementById("registerForm");
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(registerForm);
  formData.append("role", selectedRole);

  try {
    const response = await fetch("../api/register.php", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      message.textContent = data.message;
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } else {
      message.textContent = `Error: ${data.error}`;
    }
  } catch (err) {
    message.textContent = "Error connecting to server.";
    console.error(err);
  }
});
