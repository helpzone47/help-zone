
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginPanel = document.getElementById("loginPanel");
  const inboxPanel = document.getElementById("inboxPanel");
  const loginNotice = document.getElementById("loginNotice");
  const logoutBtn = document.getElementById("logoutBtn");
  const messages = document.getElementById("messages");

  if (!loginForm) return;

  async function loadMessages() {
    try {
      const response = await fetch("/api/messages");
      if (response.status === 401) {
        loginPanel.classList.remove("hidden");
        inboxPanel.classList.add("hidden");
        return;
      }

      if (!response.ok) throw new Error("মেসেজ লোড হয়নি");

      const data = await response.json();
      loginPanel.classList.add("hidden");
      inboxPanel.classList.remove("hidden");

      messages.replaceChildren();

      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        messages.textContent = "এখনো কোনো মেসেজ নেই।";
        return;
      }

      data.messages.forEach((item) => {
        const article = document.createElement("article");
        const heading = document.createElement("h3");
        const body = document.createElement("p");

        heading.textContent = item.name || "নাম নেই";
        body.textContent = item.message || "";

        article.append(heading, body);
        messages.append(article);
      });
    } catch (error) {
      messages.textContent = "মেসেজ লোড করা যায়নি।";
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = loginForm.elements.password.value;
    const button = loginForm.querySelector("button");

    button.disabled = true;
    loginNotice.textContent = "লগইন হচ্ছে...";

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (!response.ok) {
        loginNotice.textContent = result.error || "লগইন ব্যর্থ হয়েছে।";
        return;
      }

      loginNotice.textContent = "লগইন সফল!";
      await loadMessages();
    } catch (error) {
      loginNotice.textContent = "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।";
    } finally {
      button.disabled = false;
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      location.reload();
    });
  }

  loadMessages();
});
