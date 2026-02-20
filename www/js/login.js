import { setCookie } from "./utils.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  try {
    const response = await fetch("../api/login.php", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      // On successful login, set a uid cookie to keep track of the sesion.
      // This is insecure and in a real world environment, a session token should be used.
      // With this structure, the API will not require any authentication to be called
      // and all endpoints would need to be updated for real world use as well.
      setCookie("uid", data.uid, 1);
      window.location.href = "/";
    } else {
      message.textContent = `Login failed: ${data.error}`;
    }
  } catch (err) {
    message.textContent = "Error connecting to server.";
    console.error(err);
  }
});
