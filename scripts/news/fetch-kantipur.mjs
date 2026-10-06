const url = "https://ekantipur.com/";

async function main() {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  console.log("HTTP status:", response.status);

  if (!response.ok) {
    throw new Error(`Website request failed: ${response.status}`);
  }

  const html = await response.text();

  console.log("HTML length:", html.length);
  console.log("First 500 characters:");
  console.log(html.slice(0, 500));
}

main().catch((error) => {
  console.error("Could not fetch Kantipur:", error.message);
  process.exitCode = 1;
});