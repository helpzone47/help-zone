
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
      title.textContent = item.name;

      const contact = document.createElement("p");
      contact.textContent = "যোগাযোগ: " + item.contact;

      const topic = document.createElement("p");
      topic.textContent = "বিষয়: " + item.topic;

      const body = document.createElement("p");
      body.textContent = item.body;

      card.append(title, contact, topic, body);

      if (item.admin_reply) {
        const oldReply = document.createElement("p");
        oldReply.textContent = "আপনার উত্তর: " + item.admin_reply;
        card.append(oldReply);
      }

      const replyForm = document.createElement("form");
      const replyBox = document.createElement("textarea");
      replyBox.name = "reply";
      replyBox.placeholder = "কাস্টমারকে উত্তর লিখুন...";
      replyBox.required = true;
      replyBox.maxLength = 2000;

      const replyButton = document.createElement("button");
      replyButton.type = "submit";
      replyButton.textContent = "উত্তর পাঠান";

      const notice = document.createElement("p");
      notice.setAttribute("role", "status");

      replyForm.append(replyBox, replyButton, notice);

      replyForm.addEventListener("submit", async event => {
        event.preventDefault();

        const reply = replyBox.value.trim();
        if (!reply) return;

        replyButton.disabled = true;
        notice.textContent = "উত্তর পাঠানো হচ্ছে...";

        try {
          const result = await fetch(
            `/api/messages/${item.id}/reply`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ reply })
            }
          );

          const data = await result.json();

          if (!result.ok) {
            throw new Error(data.error || "উত্তর পাঠানো যায়নি");
          }

          notice.textContent = "উত্তর সফলভাবে সংরক্ষণ হয়েছে!";
          await loadMessages();

        } catch (error) {
          notice.textContent = error.message;
          replyButton.disabled = false;
        }
      });

      card.append(replyForm);
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
    messages.textContent = "ইনবক্স লোড করা যায়নি। Refresh করুন।";
  }
});
