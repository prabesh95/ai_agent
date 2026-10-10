import * as cheerio from "cheerio";

const url = "https://ekantipur.com/";
const origin = new URL(url).origin;

async function main() {
  // Fetch the homepage.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  console.log("HTTP status:", response.status);

  if (!response.ok) {
    throw new Error(`Website request failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Collect unique internal links.
  const links = [];
  const seen = new Set();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const title = $(element).text().replace(/\s+/g, " ").trim();

    if (!href || !title) return;

    let link;

    try {
      link = new URL(href, url);
    } catch {
      return;
    }

    if (link.origin !== origin) return;

    link.hash = "";

    if (seen.has(link.href)) return;

    seen.add(link.href);
    links.push({ title, url: link.href });
  });

  // Keep URLs matching the article structure we observed.
  const articlePattern =
    /^\/[^/]+\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.html$/;

  const articles = links.filter((link) =>
    articlePattern.test(new URL(link.url).pathname),
  );

  console.log("Unique internal links:", links.length);
  console.log("Article links:", articles.length);

  const selectedArticle = articles[0];

  if (!selectedArticle) {
    throw new Error("No article links found.");
  }

  // Fetch one article.
  console.log("\nFetching article:", selectedArticle.url);

  const articleResponse = await fetch(selectedArticle.url, {
    signal: AbortSignal.timeout(15_000),
  });

  console.log("Article HTTP status:", articleResponse.status);

  if (!articleResponse.ok) {
    throw new Error(
      `Article request failed: ${articleResponse.status}`,
    );
  }

  const articleHtml = await articleResponse.text();
  const $article = cheerio.load(articleHtml);

  // Prefer metadata; otherwise check headings in the article header.
  const metadataHeadline = $article('meta[property="og:title"]')
    .attr("content")
    ?.trim();

  const header = $article(".news-section-wrap").first();

  const headingHeadline =
    header.find("h1").first().text().trim() ||
    header.find("h2").first().text().trim() ||
    header.find("h3").first().text().trim();

  const headline = metadataHeadline || headingHeadline;

  // Extract the article body using the container we inspected.
  const bodyParagraphs = $article(
    ".news-section-wrap-story .news-inner-wrapper p",
  )
    .map((_, element) =>
      $article(element).text().replace(/\s+/g, " ").trim(),
    )
    .get()
    .filter(Boolean);

  const articleText = bodyParagraphs.join("\n\n");

  if (!headline || !articleText) {
    throw new Error(
      "Could not extract the article headline or body. Check the page structure.",
    );
  }

  // Assemble a record. Publication time is still unknown.
  const article = {
    source: "Kantipur",
    url: selectedArticle.url,
    headline,
    body: articleText,
    publishedAt: null,
    collectedAt: new Date().toISOString(),
  };

  console.log("Extracted paragraphs:", bodyParagraphs.length);
  console.log("Article text length:", article.body.length);

  console.log("Article record:", {
    ...article,
    body: article.body.slice(0, 300),
  });
}

main().catch((error) => {
  console.error("Could not fetch Kantipur:", error.message);
  process.exitCode = 1;
}); 