# Tasks layout update

Merge this folder’s contents into D:\projects\agent after backing up your project. This update assumes the Kantipur Tasks update is already installed.

- /tasks is a compact directory with search, category/status filters, cards, and pagination (12 per page).
- /tasks/kantipur contains the existing collector, article list, and reader, with Back to Tasks navigation.
- Existing /tasks?article=... chat links redirect to the new reader workspace.
- No saved articles, collector code, API, global stylesheet, or voice code are replaced.
- Future task entries belong in lib/tasks/registry.ts, with a dedicated route for each workspace. Add task-specific status/metrics in the overview as those modules are built; the current news metrics apply only to Kantipur.

Restart npm run dev and open Tasks. Choose the Kantipur News card to view the articles you already saved. Run npm run build to check your local project.

The overview fetches current collection status when opened. It does not display a live background progress bar. The card opens the existing workspace, where collection and refresh actions remain available.

The new pages passed an isolated Next.js production build and TypeScript check against the previous supplied project. No live browser visual check was performed.
