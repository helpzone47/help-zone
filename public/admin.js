document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const loginPanel = document.getElementById("loginPanel");
  const inboxPanel = document.getElementById("inboxPanel");
  const loginNotice = document.getElementById("loginNotice");
  const logoutBtn = document.getElementById("logoutBtn");
  const messages = document.getElementById("messages");

  async function loadMessages() {
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

    if (!data.messages || data.messages.length === 0) {
      messages.textContent = "এখনো কোনো মেসেজ আসেনি।";
      return;
    }

    data.messages.forEach(item => {
      const card = document.createElement("article");
      const title = document.createElement("h3");
      const contact = document.createElement("p");
      const topic = document.createElement("p");
      const body = document.createElement("p");

      title.textContent = item.name;
      contact.textContent = "যোগাযোগ: " + item.contact;
      topic.textContent = "বিষয়: " + item.topic;
      body.textContent = item.body;

      card.append(title, contact, topic, body);
      messages.append(card);
    });
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = loginForm.querySelector("button");
    button.disabled = true;
    loginNotice.textContent = "লগইন হচ্ছে...";

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: loginForm.elements.password.value
        })
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

  logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });

  try {
    await loadMessages();
  } catch (error) {
    messages.textContent = "ইনবক্স লোড করা যায়নি। পেজ Refresh করুন।";
  }
});
