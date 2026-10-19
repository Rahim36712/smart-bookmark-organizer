# Original User Request

## 2026-09-12T11:31:52Z

This is a single self-contained fix; keep it small and focused.
Redesign and declutter the Chrome Bookmark Organizer extension UI across the dashboard and toolbar popup, hiding advanced developer tools, testing controls, and technical noise behind clean progressive disclosure so everyday users have a dead-simple, intuitive experience.

Working directory: d:\AI STUFF\PROJECTS\chrome extension
Integrity mode: development

## Requirements

### R1. Minimalist Header & Navigation
Streamline the dashboard header by removing developer buttons and technical pills, keeping only the brand logo on the left and essential actions (Rescan and Settings) on the right without visual crowding.

### R2. Relocate Testing Sandbox to Settings
Remove the Bookmark Scatter and Testing Sandbox card completely from the main dashboard view, moving it into a collapsible "Developer & Testing Tools" section at the bottom of the Settings tab.

### R3. Unified Primary Organization Action
Replace competing organize/apply buttons with a single clear primary "Clean & Organize Bookmarks" action that automatically utilizes Gemini AI if configured or fast local heuristics if not, with a simple toggle switch for user preference.

### R4. Progressive Disclosure Folder Cards
Display proposed organization as clean, visual folder cards with bookmark counts and accordion expand/collapse, keeping deep table rows, batch tools, and source filters tucked away unless explicitly expanded by the user.

### R5. Zen Minimalist Popup
Simplify the Chrome toolbar extension popup to a focused card with a single prominent 1-click organize button, clean status summary, and quick undo.

## Acceptance Criteria

### UI Decluttering & Simplification
- [ ] No testing sandbox, scatter buttons, or sample generation cards appear on the main dashboard view; all testing tools are located exclusively inside a collapsible section in the Settings tab.
- [ ] The dashboard header displays only the brand logo/title, rescan button, and settings access, with no testing buttons or cluttered badges.
- [ ] Simple Mode presents a single primary organization action that intelligently routes to Gemini AI or local heuristics without conflicting buttons.
- [ ] Proposed categories in Simple Mode are presented as clean visual cards with accordion expand/collapse to inspect contained links.
- [ ] The toolbar popup (`ui/popup.html`) displays a single prominent 1-click organize button with clear status and quick undo.
- [ ] All 162 existing automated unit and integration tests pass without regression (`npm test`).
- [ ] All JavaScript files pass syntax checks with zero errors (`node check_syntax.cjs`).
