# Progress Tracking - Declutter & Redesign UI

## Task Overview
Redesign and declutter the Chrome Bookmark Organizer extension UI across the dashboard and toolbar popup, hiding advanced developer tools, testing controls, and technical noise behind clean progressive disclosure so everyday users have a dead-simple, intuitive experience.

## Requirements Breakdown & Status
- [x] R1. Minimalist Header & Navigation: Streamlined dashboard header, displaying only the brand logo and title on the left, and essential actions (Rescan Bookmarks and Settings) on the right without visual crowding, testing buttons, or technical pills.
- [x] R2. Relocate Testing Sandbox to Settings: Removed Bookmark Scatter and Testing Sandbox card completely from main dashboard view (`#tab-organize`), moving it into a collapsible `<details class="developer-tools-card">` section at the bottom of the Settings tab.
- [x] R3. Unified Primary Organization Action: Replaced competing organize/apply buttons with a single clear primary "Clean & Organize Bookmarks" action that intelligently routes to Gemini AI or local heuristics based on user preference toggle and configuration.
- [x] R4. Progressive Disclosure Folder Cards: Implemented clean visual folder cards with bookmark counts, interactive folder and link checkboxes, and accordion expand/collapse drawers allowing users to inspect contained links while keeping deep table rows, batch tools, and source filters tucked away in Advanced Mode.
- [x] R5. Zen Minimalist Popup: Simplified toolbar popup (`ui/popup.html`, `ui/popup.js`, `ui/popup.css`) into a focused card with single prominent 1-click organize button (`#btnQuickOrganize`), clean status summary, and quick undo (`#btnQuickUndo`), removing technical auto-organize toggles and clutter.
- [x] Verification: All 162 existing automated unit and integration tests pass without regression (`npm test`), all 23 JavaScript files pass syntax checks (`node check_syntax.cjs`), and HTML/DOM structural constraints verified.
