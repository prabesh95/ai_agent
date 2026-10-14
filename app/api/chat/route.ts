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

import { searchWeb, webContext } from "../../../lib/web/search.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages, webSearch = false }: { messages: UIMessage[]; webSearch?: boolean } =
      await request.json();

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Messages must be an array." },
        { status: 400 }
      );
    }

    const lastUser = [...messages].reverse().find(message => message.role === "user");
    const question = lastUser?.parts.filter(part => part.type === "text").map(part => part.text).join(" ") ?? "";
    if (webSearch === true) {
      const origin = request.headers.get("origin");
      let sameOrigin = false;
      try { sameOrigin = Boolean(origin && new URL(origin).host === request.headers.get("host") && ["http:", "https:"].includes(new URL(origin).protocol)); } catch { /* Invalid Origin header. */ }
      if (!sameOrigin) return Response.json({ error: "Invalid search request origin." }, { status: 403 });
      if (!question.trim()) return Response.json({ error: "Enter a search question." }, { status: 400 });
      let sources;
      try { sources = await searchWeb(question, { signal: request.signal }); }
      catch (error) {
        return Response.json({ error: error instanceof Error && error.name !== "TimeoutError" ? error.message : "Web search timed out. Please retry." }, { status: 502 });
      }
      const modelMessages = await convertToModelMessages(messages);
      const stream = createUIMessageStream({
        execute({ writer }) {
          writer.write({ type: "start", messageId: crypto.randomUUID() });
          if (!sources.length) {
            writer.write({ type: "text-start", id: "no-results" });
            writer.write({ type: "text-delta", id: "no-results", delta: "Web search returned no usable source excerpts. Try a more specific question. I have not substituted an answer from model memory." });
            writer.write({ type: "text-end", id: "no-results" });
            writer.write({ type: "finish", finishReason: "stop" });
            return;
          }
          for (const source of sources) writer.write({ type: "source-url", sourceId: source.id, url: source.url, title: source.title });
          const result = streamText({ model: chatModel, system: webContext(sources), messages: modelMessages, temperature: 0.2, abortSignal: request.signal });
          writer.merge(result.toUIMessageStream({ sendStart: false }));
        },
        onError() { return "Web search succeeded, but Ollama could not generate the answer. Check that Ollama is running."; },
      });
      return createUIMessageStreamResponse({ stream });
    }
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