const STORAGE_KEY = "linkedinLeadResults";

// Suppress XLSX library errors about invalid URLs
window.addEventListener(
  "error",
  (event) => {
    if (event.message && event.message.includes("chrome-extension://invalid")) {
      event.preventDefault();
      return true;
    }
  },
  true,
);

// Also suppress unhandledrejection
window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (
      event.reason &&
      event.reason.toString().includes("chrome-extension://invalid")
    ) {
      event.preventDefault();
      return true;
    }
  },
  true,
);

const keywordsInput = document.getElementById("keywords");
const scanBtn = document.getElementById("scanBtn");
const autoSearchBtn = document.getElementById("autoSearchBtn");
const autoScrollToggle = document.getElementById("autoScrollToggle");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const resultCount = document.getElementById("resultCount");
const statusMessage = document.getElementById("statusMessage");
const resultList = document.getElementById("resultList");

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b00020" : "#6e6a62";
}

function formatCount(count) {
  return `${count} result${count === 1 ? "" : "s"}`;
}

async function getResults() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

function renderResults(results) {
  resultCount.textContent = formatCount(results.length);
  resultList.innerHTML = "";

  const recent = results.slice(-5).reverse();
  if (recent.length === 0) {
    resultList.innerHTML = "<div class='result-card'>No matches yet.</div>";
    return;
  }

  for (const item of recent) {
    const card = document.createElement("div");
    card.className = "result-card";

    // Match score badge with color coding
    const score = item.matchScore || 100;
    let scoreClass = "high";
    if (score < 90) scoreClass = "medium";
    if (score < 80) scoreClass = "low";

    const scoreBadge = score
      ? `<span class="match-score ${scoreClass}">${score}%</span>`
      : "";

    // Problem domain badge
    const domainBadge = item.problemDomain
      ? `<span class="problem-domain">${item.problemDomain.replace(/_/g, " ")}</span>`
      : "";

    // Keyword badge
    const keywordBadge = item.matchedKeyword
      ? `<span class="matched-keyword">${item.matchedKeyword}</span>`
      : "";

    card.innerHTML = `
      <div class="card-meta">
        <span class="card-author">${item.author || "Unknown"}</span>
        <div class="card-info">
          ${scoreBadge}
          <span class="card-timestamp">${item.timestamp || ""}</span>
        </div>
      </div>
      <div class="card-badges">
        ${domainBadge}
        ${keywordBadge}
      </div>
      <div class="card-text">${item.highlightedText || item.postText}</div>
    `;
    resultList.appendChild(card);
  }
}

async function refreshResults() {
  const results = await getResults();
  renderResults(results);
}

async function getActiveLinkedInTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url || !tab.url.startsWith("https://www.linkedin.com/")) {
    return null;
  }
  return tab;
}

async function sendMessageWithInjection(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (!chrome.runtime.lastError) {
        console.log("[Popup] Message sent successfully");
        resolve({ ok: true, response });
        return;
      }

      console.log(
        "[Popup] First send failed, injecting content.js and retrying",
      );
      const error = chrome.runtime.lastError;

      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["content.js"],
        },
        () => {
          const injectionError = chrome.runtime.lastError;
          if (injectionError) {
            console.error(
              "[Popup] Script injection failed:",
              injectionError.message,
            );
            resolve({
              ok: false,
              error: "Failed to inject script: " + injectionError.message,
            });
            return;
          }

          console.log("[Popup] Content script injected, retrying message");
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, payload, (retryResponse) => {
              const retryError = chrome.runtime.lastError;
              if (retryError) {
                console.error("[Popup] Retry failed:", retryError.message);
                resolve({
                  ok: false,
                  error: "Failed to communicate: " + retryError.message,
                });
                return;
              }
              console.log("[Popup] Retry successful");
              resolve({ ok: true, response: retryResponse });
            });
          }, 200);
        },
      );
    });
  });
}

async function handleScan() {
  setStatus("");
  const keywords = keywordsInput.value.trim();
  if (!keywords) {
    setStatus("Enter at least one keyword.", true);
    return;
  }

  const tab = await getActiveLinkedInTab();
  if (!tab) {
    setStatus("Open a LinkedIn feed tab to scan.", true);
    return;
  }

  console.log(
    "[Popup] Sending scan request to tab",
    tab.id,
    "with keywords:",
    keywords,
  );
  setStatus("Scanning...");

  const result = await sendMessageWithInjection(tab.id, {
    action: "scan",
    keywords,
  });

  console.log("[Popup] Scan result:", result);

  if (!result.ok) {
    setStatus(
      "Unable to communicate with the LinkedIn tab: " + result.error,
      true,
    );
    console.error("[Popup] Communication error:", result.error);
    return;
  }

  const response = result.response;
  if (!response || !response.ok) {
    const errorMsg = response?.error || "Scan failed.";

    // Show helpful message
    let displayMsg = errorMsg;
    if (errorMsg.includes("No posts found")) {
      displayMsg = errorMsg + " (Check console with F12 for details)";
    }

    setStatus(displayMsg, true);
    console.error("[Popup] Scan error:", errorMsg);
    console.error("[Popup] Full response:", response);
    return;
  }

  if (response.added === 0) {
    setStatus(response.message || "No new matches.");
  } else {
    setStatus(
      `Added ${response.added} new match${response.added === 1 ? "" : "es"}.`,
    );
  }
  refreshResults();
}

async function handleAutoSearch() {
  setStatus("");
  const keywords = keywordsInput.value.trim();
  if (!keywords) {
    setStatus("Enter at least one keyword.", true);
    return;
  }

  setStatus("Searching LinkedIn...");
  scanBtn.disabled = true;
  autoSearchBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "autoSearch",
      keywords,
    });

    if (!response || !response.ok) {
      const errorMsg = response?.error || "Search failed.";
      setStatus(errorMsg, true);
      return;
    }

    if (response.added === 0) {
      setStatus(response.message || "No new matches found.");
    } else {
      setStatus(
        `Found ${response.added} new match${response.added === 1 ? "" : "es"}.`,
      );
    }
    refreshResults();
  } catch (error) {
    setStatus("Search error: " + error.message, true);
    console.error("[Popup] Auto-search error:", error);
  } finally {
    scanBtn.disabled = false;
    autoSearchBtn.disabled = false;
  }
}

async function handleAutoScrollToggle() {
  const tab = await getActiveLinkedInTab();
  if (!tab) {
    setStatus("Open a LinkedIn feed tab to enable auto-scroll.", true);
    autoScrollToggle.checked = false;
    return;
  }

  const keywords = keywordsInput.value.trim();
  if (!keywords) {
    setStatus("Enter keywords before enabling auto-scroll.", true);
    autoScrollToggle.checked = false;
    return;
  }

  const action = autoScrollToggle.checked
    ? "startAutoScroll"
    : "stopAutoScroll";
  const result = await sendMessageWithInjection(tab.id, { action, keywords });
  const response = result.response;
  if (!result.ok || !response?.ok) {
    setStatus("Unable to toggle auto-scroll.", true);
    autoScrollToggle.checked = false;
    return;
  }
  setStatus(
    autoScrollToggle.checked ? "Auto-scroll enabled." : "Auto-scroll stopped.",
  );
}

/**
 * Enhanced Excel Export with multiple sheets and professional formatting
 */
async function handleExport() {
  try {
    console.log("[Export] Starting export process...");

    // Check if XLSX is available
    if (typeof XLSX === "undefined") {
      console.error("[Export] XLSX library not loaded");
      setStatus("XLSX not available. Retrying...", true);

      // Don't call recursively - prevent stack overflow
      return;
    }

    const results = await getResults();
    console.log("[Export] Found", results.length, "results");

    if (results.length === 0) {
      setStatus("No results to export.", true);
      return;
    }

    setStatus("Generating Excel file...");

    // Prevent UI blocking with a small delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    const workbook = XLSX.utils.book_new();
    workbook.props = {
      title: "LinkedIn Lead Report",
      author: "LinkedIn Lead Scanner",
      created: new Date(),
    };

    // ============ SHEET 1: SUMMARY STATISTICS ============
    const domainCounts = {};
    const scoreBuckets = { high: 0, medium: 0, low: 0 };

    results.forEach((item) => {
      const domain = item.problemDomain || "Not Categorized";
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      const score = item.matchScore || 100;
      if (score >= 90) scoreBuckets.high++;
      else if (score >= 80) scoreBuckets.medium++;
      else scoreBuckets.low++;
    });

    const summaryData = [
      ["LinkedIn Lead Intelligence Scanner - Export Report"],
      [],
      ["EXPORT SUMMARY"],
      ["Total Leads Found", results.length],
      ["Export Date", new Date().toLocaleString()],
      [],
      ["MATCH QUALITY BREAKDOWN"],
      ["High Quality (90-100%)", scoreBuckets.high],
      ["Medium Quality (80-89%)", scoreBuckets.medium],
      ["Lower Quality (<80%)", scoreBuckets.low],
      [],
      ["PROBLEM DOMAIN BREAKDOWN"],
    ];

    Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        summaryData.push([domain, count]);
      });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 40 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // ============ SHEET 2: DETAILED LEADS ============
    const headers = [
      "ID",
      "Author",
      "Score %",
      "Domain",
      "Keywords",
      "Text Preview",
      "Profile",
      "Scan Date",
      "Quality",
    ];

    const rows = results.map((item, index) => {
      const score = item.matchScore || 100;
      let quality = "";
      if (score >= 90) quality = "High";
      else if (score >= 80) quality = "Medium";
      else quality = "Lower";

      // Truncate post text to prevent memory issues
      const textPreview = (item.postText || "")
        .substring(0, 120)
        .replace(/\n/g, " ");

      return [
        index + 1,
        item.author || "Unknown",
        score,
        (item.problemDomain || "N/A").replace(/_/g, " "),
        item.matchedKeyword || "",
        textPreview,
        item.profileUrl || "",
        item.scanDate ? new Date(item.scanDate).toLocaleDateString() : "",
        quality,
      ];
    });

    const leadsSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    leadsSheet["!cols"] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 8 },
      { wch: 16 },
      { wch: 16 },
      { wch: 40 },
      { wch: 15 },
      { wch: 12 },
      { wch: 8 },
    ];

    XLSX.utils.book_append_sheet(workbook, leadsSheet, "Leads");

    // ============ SHEET 3: LEADS BY DOMAIN ============
    const domains = [
      ...new Set(results.map((r) => r.problemDomain || "Not Categorized")),
    ];

    for (const domain of domains) {
      const domainResults = results.filter(
        (r) => (r.problemDomain || "Not Categorized") === domain,
      );

      const domainHeaders = ["Author", "Score", "Keywords", "Preview", "Date"];
      const domainRows = domainResults.map((item) => [
        item.author || "Unknown",
        item.matchScore || 100,
        item.matchedKeyword || "",
        (item.postText || "").substring(0, 60).replace(/\n/g, " "),
        item.scanDate ? new Date(item.scanDate).toLocaleDateString() : "",
      ]);

      const domainSheet = XLSX.utils.aoa_to_sheet([
        [domain.replace(/_/g, " ").toUpperCase()],
        [],
        domainHeaders,
        ...domainRows,
      ]);

      domainSheet["!cols"] = [
        { wch: 18 },
        { wch: 8 },
        { wch: 16 },
        { wch: 35 },
        { wch: 12 },
      ];

      const sheetName = domain.substring(0, 31).replace(/_/g, " ");
      XLSX.utils.book_append_sheet(workbook, domainSheet, sheetName);
    }

    // ============ GENERATE FILE ============
    console.log("[Export] Creating XLSX file...");

    // Split XLSX write into chunks to prevent blocking
    let wbout;
    try {
      wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    } catch (err) {
      console.error("[Export] XLSX write error:", err);
      setStatus("Error generating Excel file: " + err.message, true);
      return;
    }

    console.log("[Export] XLSX write complete");

    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    console.log("[Export] Blob created, size:", blob.size, "bytes");

    const timestamp = new Date();
    const pad = (value) => value.toString().padStart(2, "0");
    const filename = `linkedin_leads_${timestamp.getFullYear()}${pad(
      timestamp.getMonth() + 1,
    )}${pad(timestamp.getDate())}_${pad(timestamp.getHours())}${pad(
      timestamp.getMinutes(),
    )}${pad(timestamp.getSeconds())}.xlsx`;

    console.log("[Export] Downloading as:", filename);

    const url = URL.createObjectURL(blob);

    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        console.log("[Export] Download triggered, ID:", downloadId);

        // Revoke URL after download starts
        setTimeout(() => {
          URL.revokeObjectURL(url);
          console.log("[Export] ObjectURL revoked");
        }, 500);

        if (chrome.runtime.lastError) {
          console.error("[Export] Download error:", chrome.runtime.lastError);
          setStatus(
            "Download error: " + chrome.runtime.lastError.message,
            true,
          );
        } else {
          setStatus(`✓ Exported! (${results.length} leads)`);
        }
      },
    );
  } catch (error) {
    console.error("[Export] Critical error:", error);
    console.error("[Export] Stack:", error.stack);
    setStatus("Export failed: " + error.message, true);
  }
}

async function handleClear() {
  chrome.runtime.sendMessage({ action: "clearResults" }, (response) => {
    if (!response || !response.ok) {
      setStatus("Failed to clear results.", true);
      return;
    }
    setStatus("Results cleared.");
    refreshResults();
  });
}

scanBtn.addEventListener("click", handleScan);
autoSearchBtn.addEventListener("click", handleAutoSearch);
autoScrollToggle.addEventListener("change", handleAutoScrollToggle);
exportBtn.addEventListener("click", handleExport);
clearBtn.addEventListener("click", handleClear);

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    refreshResults();
  }
});

// Debug function - call from console
window.testExport = async function () {
  console.log("=== EXPORT DEBUG TEST ===");
  console.log("XLSX available:", typeof XLSX !== "undefined");
  const results = await getResults();
  console.log("Results count:", results.length);
  if (results.length > 0) {
    console.log("Sample result:", results[0]);
    handleExport();
  } else {
    console.log("No results to export. Create some first!");
  }
};

refreshResults();
