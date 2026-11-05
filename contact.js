const contactForm = document.querySelector("[data-contact-form]");

if (contactForm instanceof HTMLFormElement) {
  const formStatus = contactForm.querySelector("[data-form-status]");
  const successMessage = contactForm.parentElement?.querySelector("[data-form-success]");
  const submitButton = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const honeypot = contactForm.elements.namedItem("_gotcha");
    if (honeypot instanceof HTMLInputElement && honeypot.value.trim()) return;

    const endpoint = contactForm.action;
    if (endpoint.includes("REPLACE_WITH_FORM_ID")) {
      if (formStatus) {
        formStatus.textContent = "The form is not connected yet. Please use email or WhatsApp for now.";
        formStatus.hidden = false;
      }
      return;
    }

    if (!(submitButton instanceof HTMLButtonElement)) return;
    const originalLabel = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = "SENDING…";
    if (formStatus) formStatus.hidden = true;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("The form service could not accept this message.");

      contactForm.hidden = true;
      if (successMessage) successMessage.hidden = false;
      contactForm.reset();
    } catch (error) {
      if (formStatus) {
        formStatus.textContent = error instanceof Error
          ? `${error.message} Please try email or WhatsApp instead.`
          : "Something went wrong. Please try email or WhatsApp instead.";
        formStatus.hidden = false;
      }
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalLabel;
    }
  });
}
