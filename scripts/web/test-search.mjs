async function main() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is missing.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "latest news about Nepal",
      topic: "news",
      time_range: "day",
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  console.log("HTTP status:", response.status);

  if (!response.ok) {
    throw new Error(`Search failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  for (const result of data.results ?? []) {
    console.log("\nTitle:", result.title);
    console.log("URL:", result.url);
    console.log("Published:", result.published_date ?? "Unknown");
    console.log("Excerpt:", result.content);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});