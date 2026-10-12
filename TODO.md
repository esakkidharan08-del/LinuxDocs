# LinuxDocs Feature Checklist

- [x] Inspect current command pages, API, auth gate, and verification commands
- [x] Implement command builder for opt-in commands
- [x] Implement Explain This Command
- [x] Implement browser-only Practice Terminal and progress persistence
- [x] Implement quizzes and learning paths
- [x] Implement print-friendly cheat sheets
- [x] Implement command comparison view
- [x] Implement Command of the Day and random command
- [x] Implement bookmark/note export and JSON import
- [x] Implement keyboard shortcuts help and navigation
- [x] Implement session security and development password reset
- [x] Add report-a-mistake links to command pages
- [x] Run final verification and report per feature

## Verification

- Frontend production build: `npm run build`
- Backend tests: `32 passed`
- Dataset validation: `python backend/check_links.py` -> `link-check: PASS`
