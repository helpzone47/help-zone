const form = document.getElementById("contactForm");
const notice = document.getElementById("notice");

if (form && notice) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "পাঠানো হচ্ছে...";
    notice.textContent = "";

    const data = {
      name: form.elements.name.value.trim(),
      contact: form.elements.contact.value.trim(),
      topic: form.elements.topic.value,
      body: form.elements.body.value.trim()
    };

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "মেসেজ পাঠানো যায়নি।");
      }

      notice.textContent = "মেসেজ সফলভাবে পাঠানো হয়েছে!";
      form.reset();

    } catch (error) {
      notice.textContent = error.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।";
    } finally {
      button.disabled = false;
      button.textContent = "মেসেজ পাঠান";
    }
  });
}
