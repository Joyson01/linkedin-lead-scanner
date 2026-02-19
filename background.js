const STORAGE_KEY = "linkedinLeadResults";

/**
 * Auto-search LinkedIn for keywords
 * Navigates to LinkedIn search page and scans results
 */
async function autoSearchLinkedIn(keywords) {
  try {
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

    const tab = await chrome.tabs.create({ url: searchUrl, active: false });

    // Wait for page to load, then inject and scan
    return new Promise((resolve) => {
      setTimeout(() => {
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            files: ["content.js"],
          },
          () => {
            setTimeout(() => {
              chrome.tabs.sendMessage(
                tab.id,
                { action: "scan", keywords },
                (response) => {
                  if (!chrome.runtime.lastError) {
                    console.log("[Background] Auto-search completed");
                    // Close the tab after scanning
                    chrome.tabs.remove(tab.id);
                    resolve(response);
                  } else {
                    console.error(
                      "[Background] Auto-search failed:",
                      chrome.runtime.lastError.message,
                    );
                    chrome.tabs.remove(tab.id);
                    resolve({ ok: false, error: "Auto-search failed" });
                  }
                },
              );
            }, 2000);
          },
        );
      }, 3000); // Give page 3 seconds to load
    });
  } catch (error) {
    console.error("[Background] Auto-search error:", error.message);
    return { ok: false, error: error.message };
  }
}

function normalizeKey(postText, profileUrl) {
  const text = (postText || "").trim().replace(/\s+/g, " ").toLowerCase();
  const url = (profileUrl || "").trim().toLowerCase();
  return `${text}::${url}`;
}

async function getStoredResults() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setStoredResults(results) {
  await chrome.storage.local.set({ [STORAGE_KEY]: results });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    return;
  }

  if (message.action === "autoSearch") {
    const keywords = message.keywords || "";
    autoSearchLinkedIn(keywords).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.action === "addResults") {
    (async () => {
      const incoming = Array.isArray(message.results) ? message.results : [];
      const existing = await getStoredResults();
      const seen = new Set(
        existing.map((item) => normalizeKey(item.postText, item.profileUrl)),
      );
      const merged = [...existing];

      for (const item of incoming) {
        const key = normalizeKey(item.postText, item.profileUrl);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }

      await setStoredResults(merged);
      sendResponse({
        ok: true,
        total: merged.length,
        added: merged.length - existing.length,
      });
    })().catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.action === "clearResults") {
    (async () => {
      await setStoredResults([]);
      sendResponse({ ok: true, total: 0 });
    })().catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.action === "getResults") {
    (async () => {
      const results = await getStoredResults();
      sendResponse({ ok: true, results });
    })().catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
});
