# Smart Bookmark Organizer (Free & Privacy-First)

A Chrome extension built using **Manifest V3** that scans your bookmark tree and suggests a cleaner folder structure. Local classification works offline. Optional Gemini classification sends eligible bookmark titles and cleaned URLs to Google only after you enable it.

## Privacy & Architecture Highlights
- Local by default: Gemini is optional, requires your own API key and consent, and asks for Google API access only when you verify the key.
- Gemini privacy controls remove query strings and fragments and exclude private, local, non-web and credential-containing URLs by default.
- The Gemini key is stored separately from ordinary settings and can be removed with one button.

### Automatic Gemini fallback

The selected model is tried first. Fallback candidates are Gemini 3.6 Flash, 3.8 Flash, 3.5 Flash Lite, 3.7 Flash, 3.5 Flash, and 3.1 Flash Lite (without duplicates). Model availability depends on your Google API project; listing a model does not guarantee access or free quota.

Quota errors, missing models, server/network errors, empty output, and invalid category output move the request to the next eligible model. Each request, including reading its response, has a 12-second timeout; each batch's fallback chain has a 75-second total budget. The progress message identifies the model being tried. A working model is reused for subsequent batches.

Failed models enter an in-memory cooldown with exponential backoff. Quota errors start at 60 seconds, unavailable models at 15 minutes, and other temporary errors at 15 seconds. Longer API retry instructions are honored. Cooldowns last for the dashboard session and reset when the API key changes. Invalid credentials, invalid requests, and safety blocks stop rotation.

When all candidates fail or are cooling down, completed AI classifications are retained and remaining bookmarks receive local suggestions for review before organizing. The dashboard reports AI/local counts; temporary failures do not permanently disable AI. Connection verification uses the same fallback pipeline. Switching models cannot resolve an invalid key or a quota shared across the whole project.
- Permissions: bookmarks and local extension storage. Google Gemini endpoint access is optional and requested only when AI is enabled.
- Recovery First: Bookmark moves, duplicate cleanup, imports and automatic organization create or update a local recovery snapshot before changing bookmarks.
- Never Deletes Without Explicit Approval: Duplicate bookmarks can be reviewed and only deleted when the user confirms with an explicit dialog.

## Key Features
1. Deep Recursive Tree Traversal: Recursively traverses every folder, bookmark bar, mobile bookmarks, and nested subfolders to any depth.
2. Intelligent Local Categorization: Multi-signal scoring engine combining domain taxonomy, TLD heuristics, URL path keywords, title NLP tokenization, and compound contextual boosters.
   - Predefined categories: Germany, Study Abroad, Programming, AI & Technology, Career & Jobs, Education, Research, Finance, Entertainment, News, Shopping, Travel, Tools, Design, Health, Social.
3. Interactive Preview & Customization: Starts with simple folder cards and one main action. Advanced editing provides a full table, filters and batch changes when needed.
4. Undo / Restore: Recovery snapshots are written before changes. One-click restoration retries safely if a bookmark has changed or disappeared.
5. Duplicate URL Detection: Normalized URL matching strips tracking parameters and hashes. Safe duplicate cleanup.
6. Automatic Future Organization: Background service worker organizes newly saved bookmarks in real-time.

## Installation
1. Open Chrome and navigate to chrome://extensions/
2. Enable Developer mode toggle in the top-right corner.
3. Click Load unpacked and select this project directory.

If already installed, click the extension’s Reload button and reopen its dashboard to use the updated interface.

## Everyday workflow

### Review first, then organize

The **Review before organizing** list shows uncertain suggestions with their reasons and competing categories. Choose a destination, use the suggestion, or leave a link in place. Up to 50 entries are shown at once, with **Show more** for larger collections. After organizing, the dashboard shows a completion summary instead of reopening Needs Review. **Start a new review** or **Scan again** brings the preparation screen back; unselected bookmarks remain untouched.

Classification weighs page topics more strongly than mixed-topic hosts such as YouTube, GitHub, and Reddit, ignores tracking parameters, and lowers confidence for close category scores. Folder corrections are saved for the exact page rather than the entire website. Existing broad rules for mixed-topic websites require review; they can be removed in Settings. AI results include confidence, preserve saved page corrections, and require review when they conflict with strong local evidence. Unclassified bookmarks need a chosen destination before they can be moved; the organizer does not create a Needs Review folder for them.

The dashboard and popup use local CSS 3D folder artwork, layered cards, and subtle pointer depth. No external graphics library or extra permissions are required. Motion respects the system’s reduced-motion preference; the folder controls remain stationary and keyboard accessible.

- The popup opens **Review & organize** in a persistent dashboard. Bookmark moves no longer run inside the temporary popup window.
- Review the summary: selected to move, left for review, already in place, and protected.
- Expand a folder card to inspect each link’s original and proposed locations. Strong matches are selected by default; other suggestions require your selection.
- Choose a destination, then review and confirm the move count. AI previews require review before applying.
- During moves, **Stop after current bookmark** stops remaining work; completed moves remain in Undo history. Keep the dashboard open until the operation finishes and its snapshot is saved.
- Undo history retains the latest 20 snapshots. Export a JSON backup for longer-term safekeeping.

## Resetting the folder layout

Open **Settings → Maintenance → Reset folders** to move all editable bookmarks directly into their current browser section (Bookmarks Bar, Other Bookmarks, or Mobile Bookmarks), then delete custom folders once empty. Confirm the summary before starting. This includes folders protected from normal organization; browser-managed items and built-in sections remain. No bookmarks are deleted. Non-empty folders are kept if a move fails or a new link arrives during the reset.

A snapshot is saved before any changes. **Undo history → Folder Reset → Restore This State** recreates the original hierarchy, including empty and same-name folders, and restores bookmark order. Keep the dashboard open until completion, then use **Review & organize** to categorize the flattened links again. Snapshot history retains the latest 20 operations; export a backup for longer-term storage.

## Protecting folders

In **Settings → Protect folders from organization**, check any folders you want to preserve. Protection follows folder IDs, includes nested folders, and excludes their links from organization and Gemini requests. Protected folders are also skipped during empty-folder cleanup and cannot be organization destinations. Duplicate cleanup, developer tools, and manually requested restores are separate operations.

The **Select strong matches only** setting controls initial selection and background auto-organization. You can still explicitly select other suggestions in the preview.

## Disposable UI preview

Run `node tests/preview-server.cjs` and open `http://127.0.0.1:8765/ui/dashboard.html` or `/ui/popup.html`. This uses in-memory sample bookmarks and never accesses real Chrome bookmarks. Reloading resets the sample data. Stop the server with Ctrl+C.

## Running Tests
npm test
npm run syntax
