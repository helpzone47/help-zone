document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("setupForm");
  const notice = document.getElementById("setupNotice");

  if (!form || !notice) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const setupKey = form.elements.setupKey.value.trim();
    const password = form.elements.password.value;
    const button = form.querySelector("button");

    if (password.length < 12) {
      notice.textContent = "পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।";
      return;
    }

    button.disabled = true;
    notice.textContent = "সেটআপ চলছে...";

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          setupKey,
          password
        })
      });

      const result = await response.json();

      notice.textContent =
        result.message ||
        (response.ok ? "অ্যাডমিন তৈরি হয়েছে!" : "সেটআপ ব্যর্থ হয়েছে।");

      if (response.ok) {
        window.location.href = "/admin.html";
      }
    } catch (error) {
      notice.textContent = "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।";
    } finally {
      button.disabled = false;
    }
  });
});
