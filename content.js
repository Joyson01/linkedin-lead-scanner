const POST_SELECTORS = [
  // LinkedIn Feed posts - newer structure
  "div[data-test-id='feed-item']",
  "div.feed-shared-update-v2",
  "div.feed-shared-update",

  // Posts with URN attributes
  "[data-urn*='urn:li:activity']",
  "[data-id*='urn:li:activity']",
  "[data-urn*='urn:li:ugcPost']",
  "[data-id*='urn:li:ugcPost']",

  // Generic article and container selectors
  "div[role='article']",
  "[role='article']",
  "article",

  // Feed container posts
  "div.occludable-update",
  "div.update",
  "div.feed-shared-update-v2__container",

  // Scroll container posts
  "div.scaffold-finite-scroll__content > div[class*='update']",
  "div.scaffold-finite-scroll__content > div[data-urn]",
  "div.scaffold-finite-scroll__content > div[data-id]",

  // Main feed container
  "main div[class*='update']",
  "main [role='article']",
  "main article",

  // Post containers by text content
  "li[type='tln_activity']",
  "div.core-rail > div > div",

  // Search results posts
  "li.base-search-result",
  "div.entity-result__item",
  "div.search-result",
  "div[data-test-id='search-result-item']",

  // Article and content posts
  "div.feed-shared-article",
  "div.feed-shared-news",
  "div.feed-shared-document",

  // Comment sections and discussions
  "div.comments-container > div",
  "div.comment-item",
];

const TEXT_SELECTORS = [
  // Primary text content
  "span.break-words",
  "div.update-components-text",
  "div.update-components-text span",

  // Commentary and post text
  "div.feed-shared-update-v2__commentary",
  "div.feed-shared-update-v2__description-wrapper",
  "div.feed-shared-text",

  // Generic text containers
  "p[class*='text']",
  ".post-text",
  ".update-text",

  // Article content
  "article p",
  "article span",
  "article div",
];

const AUTHOR_SELECTORS = ["a[href*='/in/']", "a[href*='/company/']"];

const TIMESTAMP_SELECTORS = [
  "time",
  "span.feed-shared-actor__sub-description span[aria-hidden='true']",
  "span.update-components-actor__sub-description span[aria-hidden='true']",
];

const SCROLL_INTERVAL_MS = 2000;
const MAX_SCROLLS = 10;

let currentKeywords = [];
let autoScrollEnabled = false;
let scrollTimerId = null;
let scrollCount = 0;
let scanScheduled = false;

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getPostElements() {
  const elements = new Set();

  // Try primary selectors
  for (const selector of POST_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach((el) => elements.add(el));
    } catch (e) {
      console.warn(`[Content] Invalid selector: "${selector}"`);
    }
  }

  console.log(`[Content] Found ${elements.size} posts with primary selectors`);

  // Fallback: Look in main element
  if (elements.size === 0) {
    const main = document.querySelector("main");
    if (main) {
      main
        .querySelectorAll(
          "article, div[data-urn], div[data-id], div[role='article']",
        )
        .forEach((el) => elements.add(el));
      console.log(`[Content] Found ${elements.size} posts in main element`);
    }
  }

  // Fallback: Look in feed container
  if (elements.size === 0) {
    const feedContainer = document.querySelector(
      "div.scaffold-finite-scroll__content, div.core-rail, [role='main']",
    );
    if (feedContainer) {
      feedContainer.querySelectorAll("div, article, li").forEach((el) => {
        // Filter by having some depth and text content
        if (el.innerText && el.innerText.length > 10) {
          elements.add(el);
        }
      });
      console.log(`[Content] Found ${elements.size} posts in feed container`);
    }
  }

  // Fallback: Generic search across document
  if (elements.size === 0) {
    document
      .querySelectorAll(
        "article, div[data-urn], div[data-id], div[role='article']",
      )
      .forEach((el) => elements.add(el));
    console.log(
      `[Content] Found ${elements.size} posts with generic selectors`,
    );
  }

  // AGGRESSIVE FALLBACK: Look for divs with substantial text content
  if (elements.size === 0) {
    console.log(
      "[Content] Using aggressive fallback - searching for text-rich divs...",
    );
    const allDivs = document.querySelectorAll("div");
    console.log(`[Content] Total divs on page: ${allDivs.length}`);

    // Look for divs that likely contain posts (have some text, reasonable dimensions)
    allDivs.forEach((div) => {
      const text = div.innerText?.trim() || "";
      const rect = div.getBoundingClientRect();

      // Heuristic: post-like divs have text AND reasonable dimensions
      if (
        text.length > 50 && // Has substantial text
        text.length < 10000 && // Not too much (comments section)
        rect.width > 300 && // Wide enough
        rect.height > 100 && // Tall enough
        rect.height < 2000 // Not the entire page
      ) {
        elements.add(div);
      }
    });

    console.log(
      `[Content] Found ${elements.size} posts with aggressive fallback`,
    );
  }

  const visible = Array.from(elements).filter(isElementVisible);
  console.log(`[Content] ${visible.length} posts are visible`);

  // Log some debugging info
  if (visible.length > 0) {
    console.log(
      `[Content] Sample post text: "${visible[0].innerText?.substring(0, 100)}..."`,
    );
  }

  return visible;
}

function getFirstText(element, selectors) {
  // Try specific selectors first
  for (const selector of selectors) {
    try {
      const target = element.querySelector(selector);
      if (target && target.textContent) {
        const text = target.textContent.trim();
        if (text && text.length > 5) {
          return text;
        }
      }
    } catch (e) {
      // Skip invalid selectors
    }
  }

  // Fallback: get text from element itself if it looks like a post
  const elementText =
    element.innerText?.trim() || element.textContent?.trim() || "";
  if (elementText && elementText.length > 10) {
    // Don't return massive text (likely includes comments, etc)
    if (elementText.length < 5000) {
      return elementText.substring(0, 1000);
    }
  }

  return "";
}

function getAuthor(element) {
  for (const selector of AUTHOR_SELECTORS) {
    const anchor = element.querySelector(selector);
    if (anchor && anchor.textContent) {
      return {
        name: anchor.textContent.trim(),
        url: anchor.href,
      };
    }
  }
  const fallback = element.querySelector("a[href]");
  if (fallback && fallback.textContent) {
    return {
      name: fallback.textContent.trim(),
      url: fallback.href,
    };
  }
  return { name: "", url: "" };
}

function getTimestamp(element) {
  const timestamp = getFirstText(element, TIMESTAMP_SELECTORS);
  return timestamp || "";
}

function parseKeywords(raw) {
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Levenshtein distance calculator for fuzzy matching
 * Returns the minimum number of edits needed to transform one string into another
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100, where 100 is identical
 */
function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return ((maxLen - distance) / maxLen) * 100;
}

/**
 * Normalize text for matching:
 * - Convert to lowercase
 * - Remove punctuation
 * - Normalize whitespace
 * - Remove extra spaces
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation, replace with space
    .replace(/\s+/g, " ") // Normalize multiple spaces to single space
    .trim();
}

/**
 * Problem Domain Taxonomy
 * Maps common problem keywords to related terms for better matching
 */
const PROBLEM_TAXONOMY = {
  shipping: {
    keywords: [
      "shipping",
      "delivery",
      "logistics",
      "shipment",
      "package",
      "parcel",
      "freight",
      "transport",
    ],
    problems: [
      "delay",
      "late",
      "lost",
      "damaged",
      "stuck",
      "not arrived",
      "customs",
    ],
    phrases: [
      "shipping delay",
      "delivery not received",
      "lost package",
      "shipping problem",
    ],
  },
  payment: {
    keywords: [
      "payment",
      "invoice",
      "billing",
      "charge",
      "transaction",
      "refund",
      "processing",
    ],
    problems: [
      "failed",
      "declined",
      "stuck",
      "pending",
      "error",
      "not processed",
      "disputed",
    ],
    phrases: [
      "payment failed",
      "payment declined",
      "billing issue",
      "refund pending",
    ],
  },
  technical: {
    keywords: [
      "bug",
      "issue",
      "error",
      "crash",
      "problem",
      "broken",
      "fail",
      "down",
    ],
    problems: ["fix", "help", "support", "urgent", "critical", "struggling"],
    phrases: ["technical issue", "system down", "software bug"],
  },
  customer_service: {
    keywords: ["service", "support", "help", "contact", "response", "assist"],
    problems: ["poor", "terrible", "bad", "unresponsive", "rude", "slow"],
    phrases: ["bad service", "poor support", "no response"],
  },
  sales_opportunity: {
    keywords: [
      "looking for",
      "seeking",
      "need",
      "want",
      "searching",
      "hiring",
      "recruiting",
    ],
    problems: [
      "cannot find",
      "hard to find",
      "difficult to reach",
      "need help",
    ],
    phrases: ["looking for", "seeking solutions"],
  },
};

/**
 * Detects if text contains problem-related content
 * Returns domain and severity score
 */
function detectProblemDomain(text) {
  const normalText = normalizeText(text);
  let bestMatch = { domain: null, score: 0 };

  for (const [domain, domainData] of Object.entries(PROBLEM_TAXONOMY)) {
    let score = 0;

    // Check keywords
    for (const kw of domainData.keywords) {
      if (normalText.includes(kw)) score += 30;
    }

    // Check problem indicators
    for (const problem of domainData.problems) {
      if (normalText.includes(problem)) score += 40;
    }

    // Check full phrases
    for (const phrase of domainData.phrases) {
      if (normalText.includes(phrase)) score += 50;
    }

    if (score > bestMatch.score) {
      bestMatch = { domain, score: Math.min(score, 100) };
    }
  }

  return bestMatch;
}

/**
 * Advanced keyword matching function
 * Supports:
 * - Case-insensitive matching
 * - Flexible spacing
 * - Minor spelling mistakes
 * - Multi-word phrases
 * - Fuzzy matching with 80% similarity threshold
 * - Problem domain detection
 *
 * Returns: { matched: boolean, score: number (0-100), matchedText: string, domain: string }
 */
function matchesKeyword(text, keyword) {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  // STEP 1: Exact match after normalization
  if (normalizedText.includes(normalizedKeyword)) {
    console.log(`[Match] Exact: "${keyword}" found in text`);
    return { matched: true, score: 100, matchedText: keyword };
  }

  // STEP 2: Regex with flexible spacing
  // "order not received" matches "order    not    received" or "order...not...received"
  const regexPattern = normalizedKeyword.replace(/\s+/g, "\\s+");
  const regex = new RegExp(regexPattern, "i");
  if (regex.test(normalizedText)) {
    console.log(`[Match] Regex: "${keyword}" matched with flexible spacing`);
    return { matched: true, score: 95, matchedText: keyword };
  }

  // STEP 3: Word-by-word fuzzy matching for multi-word phrases
  const keywordWords = normalizedKeyword.split(/\s+/);
  const textWords = normalizedText.split(/\s+/);

  if (keywordWords.length > 1) {
    // Check if all keyword words appear in order with fuzzy tolerance
    let keywordIndex = 0;
    let matchedWordsCount = 0;

    for (const textWord of textWords) {
      if (keywordIndex >= keywordWords.length) break;

      const keywordWord = keywordWords[keywordIndex];
      const similarity = calculateSimilarity(textWord, keywordWord);

      // 80% similarity threshold for individual words
      if (similarity >= 80) {
        matchedWordsCount++;
        keywordIndex++;
      }
    }

    // If all keyword words matched with fuzzy tolerance
    if (matchedWordsCount === keywordWords.length) {
      const overallScore = 85;
      console.log(
        `[Match] Fuzzy multi-word: "${keyword}" matched with ${overallScore}% confidence`,
      );
      return { matched: true, score: overallScore, matchedText: keyword };
    }
  }

  // STEP 4: Single-word or phrase-level fuzzy matching
  // Check if the entire keyword phrase appears anywhere with typos
  for (let i = 0; i <= textWords.length - keywordWords.length; i++) {
    const textSegment = textWords.slice(i, i + keywordWords.length).join(" ");
    const similarity = calculateSimilarity(textSegment, normalizedKeyword);

    if (similarity >= 80) {
      console.log(
        `[Match] Fuzzy phrase: "${keyword}" matched "${textSegment}" with ${similarity.toFixed(1)}% similarity`,
      );
      return {
        matched: true,
        score: Math.round(similarity),
        matchedText: textSegment,
      };
    }
  }

  // STEP 5: Partial word matching for single keywords
  if (keywordWords.length === 1) {
    for (const textWord of textWords) {
      const similarity = calculateSimilarity(textWord, normalizedKeyword);
      if (similarity >= 85) {
        console.log(
          `[Match] Fuzzy word: "${keyword}" matched "${textWord}" with ${similarity.toFixed(1)}% similarity`,
        );
        return {
          matched: true,
          score: Math.round(similarity),
          matchedText: textWord,
        };
      }
    }
  }

  // STEP 6: Problem domain matching
  // If keyword is a problem domain keyword, check for related issues
  const problemMatch = detectProblemDomain(normalizedKeyword);
  if (problemMatch.domain) {
    const domainData = PROBLEM_TAXONOMY[problemMatch.domain];
    let textScore = 0;

    // Check if text contains problem indicators from matching domain
    for (const problem of domainData.problems) {
      if (normalizedText.includes(problem)) {
        textScore = Math.max(textScore, 75);
        console.log(
          `[Match] Problem domain: "${keyword}" (${problemMatch.domain}) found problem indicator: "${problem}"`,
        );
        return {
          matched: true,
          score: textScore,
          matchedText: problemMatch.domain,
          domain: problemMatch.domain,
        };
      }
    }
  }

  return { matched: false, score: 0, matchedText: "" };
}

function highlightKeywords(text, keywords) {
  if (!text) {
    return "";
  }
  let output = escapeHtml(text);

  // Try to highlight each keyword with flexible matching
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    // Exact match highlighting (case-insensitive)
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactRegex = new RegExp(`(${escapedKeyword})`, "gi");
    output = output.replace(exactRegex, "<mark>$1</mark>");

    // Flexible spacing highlight
    const flexiblePattern = normalizedKeyword.split(/\s+/).join("\\s+");
    const flexRegex = new RegExp(`(${flexiblePattern})`, "gi");
    output = output.replace(flexRegex, "<mark>$1</mark>");
  }

  return output;
}

function findMatches(posts, keywords) {
  const matches = [];
  const localSeen = new Set();

  console.log(
    `[Scan] Scanning ${posts.length} posts for keywords: ${keywords.join(", ")}`,
  );

  for (const post of posts) {
    const postText =
      getFirstText(post, TEXT_SELECTORS) || post.innerText.trim();
    if (!postText) {
      continue;
    }

    // Check each keyword against the post
    const matchResults = [];
    for (const keyword of keywords) {
      const result = matchesKeyword(postText, keyword);
      if (result.matched) {
        matchResults.push({
          keyword: keyword,
          score: result.score,
          matchedText: result.matchedText,
        });
      }
    }

    // If no keywords matched, skip this post
    if (matchResults.length === 0) {
      continue;
    }

    const { name, url } = getAuthor(post);
    const key = `${postText.trim().toLowerCase()}::${(url || "").toLowerCase()}`;
    if (localSeen.has(key)) {
      continue;
    }
    localSeen.add(key);

    // Calculate overall match score (highest score among matched keywords)
    const maxScore = Math.max(...matchResults.map((r) => r.score));
    const matchedKeywordsList = matchResults.map((r) => r.keyword).join(", ");

    // Log matched post
    const snippet = postText.substring(0, 100).replace(/\n/g, " ");
    console.log(
      `[Match Found] Score: ${maxScore}% | Keywords: ${matchedKeywordsList} | Post: "${snippet}..."`,
    );

    // Detect problem domain for better categorization
    const problemDomain = detectProblemDomain(postText);

    matches.push({
      matchedKeyword: matchedKeywordsList,
      matchScore: maxScore,
      author: name,
      profileUrl: url,
      postText,
      highlightedText: highlightKeywords(postText, keywords),
      timestamp: getTimestamp(post),
      scanDate: new Date().toISOString(),
      problemDomain: problemDomain.domain,
      problemScore: problemDomain.score,
    });
  }

  console.log(`[Scan Complete] Found ${matches.length} matches`);
  return matches;
}

async function scanVisiblePosts(rawKeywords) {
  const keywords = parseKeywords(rawKeywords);
  if (keywords.length === 0) {
    return { ok: false, error: "Please enter at least one keyword." };
  }

  const posts = getPostElements();
  if (posts.length === 0) {
    // Provide helpful debugging info
    const pageUrl = window.location.href;
    const isLinkedInFeed =
      pageUrl.includes("/feed/") || pageUrl.includes("linkedin.com/");
    const hasMain = document.querySelector("main") ? "yes" : "no";
    const scrollContainer = document.querySelector(
      ".scaffold-finite-scroll__content",
    )
      ? "yes"
      : "no";
    const allDivs = document.querySelectorAll("div").length;

    console.error("[Content] Debugging info:", {
      pageUrl,
      isLinkedInFeed,
      hasMainElement: hasMain,
      hasScrollContainer: scrollContainer,
      totalDivsOnPage: allDivs,
    });

    const errorMsg = isLinkedInFeed
      ? "No posts found. Try scrolling up to load more posts, or wait a few seconds for the page to load."
      : "Not on LinkedIn feed page. Go to https://www.linkedin.com/feed/ and try again.";

    return { ok: false, error: errorMsg };
  }

  const matches = findMatches(posts, keywords);
  if (matches.length === 0) {
    return { ok: true, added: 0, total: 0, message: "No matches found." };
  }

  const response = await chrome.runtime.sendMessage({
    action: "addResults",
    results: matches,
  });
  if (!response || !response.ok) {
    return { ok: false, error: response?.error || "Failed to store results." };
  }

  return { ok: true, added: response.added, total: response.total };
}

function scheduleScan() {
  if (scanScheduled || currentKeywords.length === 0) {
    return;
  }
  scanScheduled = true;
  setTimeout(async () => {
    scanScheduled = false;
    await scanVisiblePosts(currentKeywords.join(","));
  }, 1200);
}

function startAutoScroll() {
  if (autoScrollEnabled) {
    return;
  }
  autoScrollEnabled = true;
  scrollCount = 0;
  scrollTimerId = setInterval(() => {
    if (scrollCount >= MAX_SCROLLS) {
      stopAutoScroll();
      return;
    }
    window.scrollBy({ top: window.innerHeight, left: 0, behavior: "smooth" });
    scrollCount += 1;
    scheduleScan();
  }, SCROLL_INTERVAL_MS);
}

function stopAutoScroll() {
  autoScrollEnabled = false;
  if (scrollTimerId) {
    clearInterval(scrollTimerId);
    scrollTimerId = null;
  }
}

const observer = new MutationObserver(() => {
  if (autoScrollEnabled) {
    scheduleScan();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    console.log("[Content] Invalid message received");
    return;
  }

  if (message.action === "scan") {
    console.log(
      "[Content] Scan action received with keywords:",
      message.keywords,
    );
    currentKeywords = parseKeywords(message.keywords || "");
    scanVisiblePosts(message.keywords || "").then((result) => {
      console.log("[Content] Scan complete, sending response:", result);
      sendResponse(result);
    });
    return true;
  }

  if (message.action === "startAutoScroll") {
    console.log("[Content] Auto-scroll started");
    currentKeywords = parseKeywords(message.keywords || "");
    startAutoScroll();
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "stopAutoScroll") {
    console.log("[Content] Auto-scroll stopped");
    stopAutoScroll();
    sendResponse({ ok: true });
    return true;
  }
});
