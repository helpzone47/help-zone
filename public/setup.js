
const form = document.querySelector("form");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const key = document.querySelector('[name="setupKey"]')?.value;
    const password = document.querySelector('[name="password"]')?.value;
    const button = form.querySelector('button[type="submit"]');

    if (!key || !password) {
      alert("সব ঘর পূরণ করুন।");
      return;
    }

    if (password.length < 12) {
      alert("পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।");
      return;
    }

    button.disabled = true;
    button.textContent = "অপেক্ষা করুন...";

    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupKey: key,
          password: password
        })
      });

      const result = await response.json();

      alert(result.message || (response.ok
        ? "অ্যাডমিন তৈরি হয়েছে।"
        : "সেটআপ ব্যর্থ হয়েছে।"));

      if (response.ok) {
        window.location.href = "/admin.html";
      }
    } catch (error) {
      alert("সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
    } finally {
      button.disabled = false;
      button.textContent = "অ্যাডমিন পাসওয়ার্ড তৈরি করুন";
    }
  });
}
