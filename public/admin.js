
document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const loginPanel = document.getElementById("loginPanel");
  const inboxPanel = document.getElementById("inboxPanel");
  const loginNotice = document.getElementById("loginNotice");
  const logoutBtn = document.getElementById("logoutBtn");
  const messages = document.getElementById("messages");

  let lang = localStorage.getItem("helpzone-lang") || "bn";

  const words = {
    bn: {
      contact: "যোগাযোগ:",
      topic: "বিষয়:",
      reply: "আপনার উত্তর:",
      placeholder: "কাস্টমারকে উত্তর লিখুন...",
      send: "উত্তর পাঠান",
      sending: "উত্তর পাঠানো হচ্ছে...",
      sent: "উত্তর সফলভাবে সংরক্ষণ হয়েছে!",
      failed: "উত্তর পাঠানো যায়নি",
      empty: "এখনো কোনো মেসেজ আসেনি।",
      loading: "ইনবক্স লোড হচ্ছে...",
      loadError: "ইনবক্স লোড করা যায়নি। Refresh করুন।",
      login: "লগইন হচ্ছে...",
      loginSuccess: "লগইন সফল!",
      loginFailed: "লগইন ব্যর্থ হয়েছে।",
      connection: "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।",
      delete: "মুছে ফেলুন",
      deleting: "মুছে ফেলা হচ্ছে...",
      deleted: "মেসেজ মুছে ফেলা হয়েছে!",
      deleteConfirm: "আপনি কি এই মেসেজটি মুছে ফেলতে চান?",
      deleteFailed: "মেসেজ মুছে ফেলা যায়নি"
    },
    en: {
      contact: "Contact:",
      topic: "Subject:",
      reply: "Your reply:",
      placeholder: "Write a reply to the customer...",
      send: "Send Reply",
      sending: "Sending reply...",
      sent: "Reply saved successfully!",
      failed: "Could not send reply",
      empty: "No messages yet.",
      loading: "Loading inbox...",
      loadError: "Could not load inbox. Please refresh.",
      login: "Logging in...",
      loginSuccess: "Login successful!",
      loginFailed: "Login failed.",
      connection: "Could not connect to the server.",
      delete: "Delete",
      deleting: "Deleting...",
      deleted: "Message deleted!",
      deleteConfirm: "Do you want to delete this message?",
      deleteFailed: "Could not delete the message"
    }
  };

  const t = key => words[lang][key] || key;

  function getLanguageButton() {
    return document.querySelector(
      "#languageToggle, #langToggle, #languageBtn, [data-lang-toggle], .language-toggle"
    ) || [...document.querySelectorAll("button")].find(button =>
      /বাংলা|english/i.test(button.textContent)
    );
  }

  function updateLanguageButton() {
    const button = getLanguageButton();
    if (button) {
      button.textContent = lang === "bn" ? "English" : "বাংলা";
    }
  }

  function applyLanguage() {
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-bn][data-en]").forEach(element => {
      element.textContent = lang === "bn"
        ? element.dataset.bn
        : element.dataset.en;
    });

    updateLanguageButton();
  }

  const languageButton = getLanguageButton();

  languageButton?.addEventListener("click", () => {
    lang = lang === "bn" ? "en" : "bn";
    localStorage.setItem("helpzone-lang", lang);
    applyLanguage();
    loadMessages();
  });

  async function loadMessages() {
    messages.textContent = t("loading");

    const response = await fetch("/api/messages");

    if (response.status === 401) {
      loginPanel.classList.remove("hidden");
      inboxPanel.classList.add("hidden");
      return;
    }

    if (!response.ok) {
      throw new Error(t("loadError"));
    }

    const data = await response.json();

    loginPanel.classList.add("hidden");
    inboxPanel.classList.remove("hidden");
    messages.replaceChildren();

    if (!data.messages || data.messages.length === 0) {
      messages.textContent = t("empty");
      return;
    }

    data.messages.forEach(item => {
      const card = document.createElement("article");

      const title = document.createElement("h3");
      title.textContent = item.name || "";

      const contact = document.createElement("p");
      contact.textContent = t("contact") + " " + (item.contact || "");

      const topic = document.createElement("p");
      topic.textContent = t("topic") + " " + (item.topic || "");

      const body = document.createElement("p");
      body.textContent = item.body || "";

      card.append(title, contact, topic, body);

      if (item.admin_reply) {
        const oldReply = document.createElement("p");
        oldReply.textContent = t("reply") + " " + item.admin_reply;
        card.append(oldReply);
      }

      const replyForm = document.createElement("form");

      const replyBox = document.createElement("textarea");
      replyBox.name = "reply";
      replyBox.placeholder = t("placeholder");
      replyBox.required = true;
      replyBox.maxLength = 2000;

      const replyButton = document.createElement("button");
      replyButton.type = "submit";
      replyButton.textContent = t("send");

      const notice = document.createElement("p");
      notice.setAttribute("role", "status");

      replyForm.append(replyBox, replyButton, notice);

      replyForm.addEventListener("submit", async event => {
        event.preventDefault();

        const reply = replyBox.value.trim();
        if (!reply) return;

        replyButton.disabled = true;
        notice.textContent = t("sending");

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

          const resultData = await result.json();

          if (!result.ok) {
            throw new Error(resultData.error || t("failed"));
          }

          notice.textContent = t("sent");
          await loadMessages();

        } catch (error) {
          notice.textContent = error.message;
          replyButton.disabled = false;
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = t("delete");

      deleteButton.addEventListener("click", async () => {
        if (!confirm(t("deleteConfirm"))) return;

        deleteButton.disabled = true;
        deleteButton.textContent = t("deleting");

        try {
          const result = await fetch(`/api/messages/${item.id}`, {
            method: "DELETE"
          });

          const resultData = await result.json();

          if (!result.ok) {
            throw new Error(resultData.error || t("deleteFailed"));
          }

          await loadMessages();

        } catch (error) {
          alert(error.message);
          deleteButton.disabled = false;
          deleteButton.textContent = t("delete");
        }
      });

      card.append(replyForm, deleteButton);
      messages.append(card);
    });
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = loginForm.querySelector("button");
    button.disabled = true;
    loginNotice.textContent = t("login");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: loginForm.elements.password.value
        })
      });

      const result = await response.json();

      if (!response.ok) {
        loginNotice.textContent = result.error || t("loginFailed");
        return;
      }

      loginNotice.textContent = t("loginSuccess");
      await loadMessages();

    } catch (error) {
      loginNotice.textContent = t("connection");
    } finally {
      button.disabled = false;
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });

  applyLanguage();

  try {
    await loadMessages();
  } catch (error) {
    messages.textContent = t("loadError");
  }
});
