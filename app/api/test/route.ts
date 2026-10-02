type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request body:", body);
    const messages = body.messages as ChatMessage[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "At least one message is required." },
        { status: 400 }
      );
    }

    const ollamaResponse = await fetch(
      "http://127.0.0.1:11434/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen2.5:3b",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful, concise assistant. Explain things clearly.",
            },
            ...messages,
          ],
          stream: false,
        }),
      }
    );

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text();

      return Response.json(
        { error: `Ollama returned an error: ${details}` },
        { status: 502 }
      );
    }

    const data = await ollamaResponse.json();

    return Response.json({
      message: data.message?.content ?? "No response was generated.",
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return Response.json(
      {
        error:
          "Could not connect to Ollama. Make sure the Ollama application is running.",
      },
      { status: 500 }
    );
  }
}