# Search web switch

Merge this folder’s contents into D:\projects\agent after backing up or committing your current project. This update targets the previously delivered chat UI, voice hook, and Kantipur backend. It replaces app/page.tsx, hooks/useVoiceConversation.ts, components/chat/ChatMessages.tsx, and app/api/chat/route.ts. If you have edited those locally, merge their changes rather than overwriting blindly. No collector, saved articles, Tasks pages, branding, globals.css, or package dependencies are replaced.

Keep your existing .env.local and add TAVILY_API_KEY if not already present. Never prefix it NEXT_PUBLIC_. No key is included in this package.

```powershell
npm run build
npm run dev
```

Restart Next.js after changing environment variables. The Search web switch appears above Voice controls, off by default. It applies to the next typed or transcribed message and stays in its chosen state for that mounted chat session. Toggle changes are disabled while the conversation is busy. Both the Review countdown and Immediate voice mode send the same setting.

- Off: existing Ollama chat and saved Kantipur news routing.
- On: send the current message to Tavily, then supply up to five cleaned source snippets to local Ollama. On overrides saved-news routing for that message.
- Sources appear beneath the answer as clickable links supplied by Tavily, not URLs invented by the model. Model citations such as [1] refer to those numbered sources.
- The model still can make mistakes, including incorrect citation numbers. These are partial excerpts, not full articles or independently verified facts.
- Today requests use Nepal’s current date in the query and a past-day provider filter. That is not a guarantee that every result was published today or describes an event today.
- Search errors are reported and do not silently fall back to model memory. Zero usable results produce an explicit no-results answer without calling Ollama.
- Stop cancels the current search/generation request. Search adds latency before the streamed answer begins.
- Search queries leave your local machine and go to Tavily. The rest of your conversation is not sent to Tavily; Ollama receives the conversation and retrieved excerpts locally.

Snippet cleanup removes obvious whole-line sharing/ad labels. It cannot reliably remove every unrelated recommendation embedded in provider text. No full-page crawler or automatic database saving is introduced.

Try a typed question with the switch on, the same question with it off, a voice question in Review and Immediate modes, Stop while waiting, a follow-up query, and a missing/invalid key. Follow-ups search the literal new message; include the topic explicitly rather than using “what about that?”. Nepali answer quality remains limited by your local model. Source titles remain original.

Your project and API remain intended for local use. Same-origin checks prevent another website triggering searches through the browser, but do not replace account authentication or spending controls for a public deployment. Each successful provider request consumes Tavily quota according to your account.

Run tests with node --test tests/web-search.test.mjs tests/web-conversation.test.mjs. The change passed six search-helper tests, four mocked hook submission scenarios, the existing voice/coordinator regression tests, an isolated production build, and a TypeScript check. Integrated HTTP checks used mocked Tavily and Ollama to verify source parts, streamed answers, saved-news routing with the switch off, no-results handling, and provider failures. No browser visual check was performed. Your successful standalone search verified your key; this integrated path still needs a live search on your PC, where that key and Ollama are available. No credentials were read or transmitted from this delivery environment.
