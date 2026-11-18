
const form = document.getElementById("contactForm");
const notice = document.getElementById("notice");

if (form && notice) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');

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

      notice.replaceChildren();

      const success = document.createElement("p");
      success.textContent = "মেসেজ সফলভাবে পাঠানো হয়েছে!";
      notice.appendChild(success);

      if (result.trackingCode) {
        const label = document.createElement("p");
        label.textContent = "আপনার Tracking Code (সংরক্ষণ করুন):";

        const code = document.createElement("strong");
        code.textContent = result.trackingCode;
        code.style.display = "block";
        code.style.padding = "12px";
        code.style.margin = "10px 0";
        code.style.background = "#eeeeee";
        code.style.borderRadius = "8px";
        code.style.overflowWrap = "anywhere";

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.textContent = "কোড কপি করুন";

        copyButton.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(result.trackingCode);
            copyButton.textContent = "কপি হয়েছে!";
          } catch (error) {
            copyButton.textContent = "কপি করা যায়নি। কোডটি লিখে রাখুন।";
          }
        });

        const instruction = document.createElement("p");
        instruction.textContent =
          "এই কোড দিয়ে ওয়েবসাইটে আপনার মেসেজের উত্তর দেখতে পারবেন।";

        notice.append(label, code, copyButton, instruction);
      }

      form.reset();

    } catch (error) {
      notice.textContent =
        error.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।";

    } finally {
      button.disabled = false;
      button.textContent = "মেসেজ পাঠান";
    }
  });
}
