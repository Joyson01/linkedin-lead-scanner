// Test Levenshtein distance
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
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[len1][len2];
}

function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return ((maxLen - distance) / maxLen) * 100;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Test cases
console.log("Test 1: recived vs received");
console.log(
  "  Similarity:",
  calculateSimilarity("recived", "received").toFixed(2) + "%",
);

console.log('\nTest 2: Normalize "Order, Not Received!"');
console.log("  Result:", normalizeText("Order, Not Received!"));

console.log("\nTest 3: Multi-word normalization");
console.log("  order not recived:", normalizeText("order not recived"));
console.log("  order not received:", normalizeText("order not received"));

console.log("\nTest 4: Word by word matching");
const text = "order not received";
const keyword = "order not recived";
const textWords = normalizeText(text).split(/\s+/);
const keywordWords = normalizeText(keyword).split(/\s+/);

console.log("  Text words:", textWords);
console.log("  Keyword words:", keywordWords);

for (let i = 0; i < keywordWords.length; i++) {
  const sim = calculateSimilarity(textWords[i], keywordWords[i]);
  console.log(
    `  "${textWords[i]}" vs "${keywordWords[i]}": ${sim.toFixed(1)}%`,
  );
}
