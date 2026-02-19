// Initialize XLSX library loading
console.log(
  "[Popup] XLSX status on load:",
  typeof XLSX !== "undefined" ? "Loaded ✓" : "Not loaded ✗",
);

// Fallback loader if XLSX doesn't load
window.addEventListener("load", () => {
  if (typeof XLSX === "undefined") {
    console.warn("[Popup] XLSX not loaded on page load, attempting to load...");
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("lib/xlsx.full.min.js");
    script.onerror = () => {
      console.error("[Popup] Failed to load XLSX library");
      document.body.classList.add("xlsx-error");
    };
    script.onload = () => {
      console.log("[Popup] XLSX loaded successfully on retry");
      document.body.classList.remove("xlsx-error");
    };
    document.head.appendChild(script);
  }
});
