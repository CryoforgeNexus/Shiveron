# Changelog

All notable changes to Shiveron are documented here. Versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- LibreTranslate reachability is checked at startup and reported in the logs, instead of only failing at the first translation
- LibreTranslate timings are logged at `debug` level, so slow translations can be attributed to the backend rather than guessed at
- `LT_THREADS` and `LT_LOAD_ONLY` in `.env.example`, to tune LibreTranslate's CPU use and the set of loaded language models

### Changed
- Guild settings are cached in memory after the first read, removing a database round trip from every message and voice state change
- Translation and language detection results are cached, so repeated phrases no longer re-run neural inference
- Auto-translation passes the already-detected source language to LibreTranslate instead of making it detect the language a second time
- Auto-translation ignores messages shorter than 12 characters, up from 4; detection on a handful of characters was guesswork the confidence gate rejected anyway
- LibreTranslate has a healthcheck and the bot waits on it through `depends_on`, replacing the polling loop in the container entrypoint
- Bot presence now points at Cryoforge Nexus
- `VoiceStateUpdateEvent` split into `src/events/voice/`: the handler now only routes, with channel lifecycle, the owner's control panel, the control message, permission building, and collector tracking each in their own module
- `VoiceCollectorManager` renamed to `CollectorManager` and moved alongside the rest of the voice code; the client property is now `client.collectorManager`
- Development moved to Cryoforge Nexus' Forgejo instance at `git.cryoforgenexus.com/Shiveron/shiveron`. GitHub is now a read-only mirror; issues and pull requests go to Forgejo
- Binary assets moved to `assets/` and are tracked with Git LFS
- Documentation split by altitude: `README.md` for running the bot, `CONTRIBUTING.md` for the process, `DEVELOPMENT.md` for the engineering manual
- Corrected the declared license in `package.json`, which said ISC while `LICENSE` has always been MIT
- Issue and pull request numbers in commits predating the migration refer to the archived GitHub tracker. History was not rewritten; `CONTRIBUTING.md` explains how to resolve them

### Fixed
- Bot failing to write its log files when `logs/` was created by Docker as root, which happened on any host where the directory did not already exist
- Auto-translation reply not being awaited, so a failed reply surfaced as an unhandled rejection instead of being logged
- Setup panel throwing instead of stopping cleanly when the join, leave or ban message prompt timed out

## [v1.2.0] — Message translation

### Added
- Auto-translation: messages are translated into the guild's configured language when a different language is detected, if the feature is enabled from the setup panel
- Flag emoji reaction translation: reacting to a message with a flag emoji translates it into that language
- `/translate` command, to translate a given text into a chosen language on demand
- Channel blacklist for auto-translation, configurable from the setup panel
- Autocompletion support in commands
- LibreTranslate added to the Docker stack as the self-hosted translation backend

### Fixed
- German translation missing from the setup panel
- Language names not going through the i18n layer in the setup panel
- Docker Compose stack failing to start in some cases

## [v1.1.2] — German translation

### Added
- German locale

## [v1.1.1] — Bug fixes

### Fixed
- Voice channel controls not refreshing in some cases
- Blacklisted users not being removed from the blacklist when already present and selected

### Changed
- Project unarchived; development resumed following the platform's revision of its privacy policy

## [v1.1.0] — Internationalization

### Added
- Internationalization, with a per-guild language setting. English and French at this stage

### Changed
- Refactored several parts of the codebase for performance

### Removed
- Deprecated packages

## [v1.0.0] — Initial release

### Added
- Moderation commands: ban, kick, timeout, warn, purge, and infraction history
- Temporary voice channels, with a contextual menu for users to manage their own channel (name, privacy, whitelist and blacklist, ownership transfer)
- Channel inheritance when the owner leaves, and auto-deletion of idle temporary channels
- Guild settings setup command
- Infraction storage, with an expiry check every 10 minutes
- Join and leave messages for voice channels
- Log files written to disk
- Docker-based deployment with PostgreSQL
- Linux setup script
