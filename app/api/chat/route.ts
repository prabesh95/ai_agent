import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

import { chatModel } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages }: { messages: UIMessage[] } =
      await request.json();

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Messages must be an array." },
        { status: 400 }
      );
    }

    const result = streamText({
      model: chatModel,

      system:
        "You are a helpful, concise assistant. Explain things clearly.",

      messages: await convertToModelMessages(messages),

      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse({
      onError(error) {
        console.error("AI stream error:", error);

        return "The AI provider could not generate a response.";
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return Response.json(
      {
        error:
          "Could not start the chat request. Make sure AI provider is running.",
      },
      { status: 500 }
    );
  }
}