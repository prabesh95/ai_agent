import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";

import { chatModel } from "@/lib/ai";

import { readStore } from "../../../lib/news/store.mjs";
import { isNewsRequest, newsReply } from "../../../lib/news/query.mjs";

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

    const lastUser = [...messages].reverse().find(message => message.role === "user");
    const question = lastUser?.parts.filter(part => part.type === "text").map(part => part.text).join(" ") ?? "";
    if (isNewsRequest(question)) {
      const text = newsReply(await readStore(), question);
      const stream = createUIMessageStream({
        execute({ writer }) {
          writer.write({ type: "start", messageId: crypto.randomUUID() });
          writer.write({ type: "text-start", id: "saved-news" });
          writer.write({ type: "text-delta", id: "saved-news", delta: text });
          writer.write({ type: "text-end", id: "saved-news" });
          writer.write({ type: "finish", finishReason: "stop" });
        },
      });
      return createUIMessageStreamResponse({ stream });
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