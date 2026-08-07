# AGENTS.md

**CRITICAL:** This file contains the engineering context for AI coding agents.

## 🚨 Absolute Rules (Never Break These) / Do Not
- **DO NOT** hard-code user-facing English. Every user-visible string goes through the i18n layer.
- **DO NOT** use `console.log`; use `client.logger`.
- **DO NOT** query a model from a command or an event. Go through a service.
- **DO NOT** read a secret from `.env`. Secrets come from Docker secrets via `getConfig`.
- **DO NOT** relax `tsconfig.json` strictness, or add `any`/`!` to make a change compile.
- **DO NOT** commit a binary asset without a matching LFS rule in `.gitattributes`.

## 📖 What to Read
- **Read `AGENTS.md` (this file)** first for every task.
- **Read `DEVELOPMENT.md`** before making any architectural or cross-cutting change.
- **Read `CONTRIBUTING.md`** before committing, for the commit conventions.
- **Read the TSDoc on the classes you are modifying**; implementation detail lives next to the code.

## ✅ Before Changing Code
- Which layer does this belong to? (commands/events → services → models. Never skip one.)
- Does it produce user-visible text? If so, it needs keys in **every** file under `src/locales/`.
- Does it need a new gateway intent? If so, add it to the `ShiveronClient` constructor, or the event silently never fires.
- Does it change a model? `sync({ alter: true })` applies it on the next boot, and a rename drops the old column and its data.

## 🛠️ Modification Priorities
1. **Add a file** under `src/commands/` or `src/events/` if the feature is a new command or handler.
2. **Extend an existing service** if the capability is missing.
3. **Touch `src/core/`** only as a last resort, and only when the framework layer genuinely lacks the capability.

## 🏗️ Code Style & Edits
- Prefer modifying existing systems over creating new abstractions.
- Avoid parallel helpers, duplicate service methods, and premature generic abstractions.
- Keep changes local to the relevant module unless the architecture requires otherwise.
- Magic numbers go in `src/utils/constants.ts`, named and grouped.

## ❓ When Unsure
If an implementation conflicts with these rules, **prefer preserving the architecture over minimizing code changes.**

## 📦 Architectural Dependency Rules
- `commands/` and `events/` depend on `services/`, `core/`, and `utils/`. They hold no persistent state.
- `services/` depend on `models/` and `core/`. They own all database and external-API access.
- `models/` depend on Sequelize only.
- `utils/` stays dependency-light: **no** service imports, **no** model imports.
- `core/` is the framework layer and must not contain feature logic.

## 🔍 File Location Hints
- `src/bot.ts`: entry point, deliberately trivial.
- `src/core/`: `ShiveronClient`, `BaseCommand`, `BaseEvent`, `Database`, `I18N`, `ShiveronLogger`.
- `src/commands/<category>/`: one slash command per file, default-exported class extending `BaseCommand`.
- `src/events/`: one gateway handler per file, default-exported class extending `BaseEvent`. Oversized handlers delegate to a feature subfolder (`src/events/voice/`), which the loader ignores.
- `src/services/`: database and external-API access.
- `src/models/`: Sequelize models, one per table.
- `src/utils/`: pure helpers. `src/utils/discord/`: stateless discord.js helpers, and only for things with more than one caller.
- `src/locales/`: one JSON file per language, copied to `dist/locales/` at build time.
- `assets/`: binary assets, tracked with Git LFS.
- `docker/`, `docker-compose.yml`: the deployment stack.
- `.forgejo/workflows/`: CI.

## ⚙️ Basic Verification Commands
- Type-check and build: `npm run build`
- Lint: `npm run lint`
- Check formatting: `npm run format:check`
- Apply fixes: `npm run lint:fix` and `npm run format`
- Run the stack: `docker compose up -d --build`, then `docker compose logs -f`

## 🚀 Quick Start Task Checklist
- [ ] Review "What to Read" and "Before Changing Code".
- [ ] Check modification priorities (new file vs. service vs. core).
- [ ] Make edits following code style guidelines.
- [ ] Add locale keys to every file in `src/locales/`.
- [ ] Run basic verification commands.
- [ ] Commit using Conventional Commits.

---

### Additional Subsystem Context

**Runtime & Module System**
- **ESM.** Relative imports must carry the `.js` extension, even in `.ts` source. `verbatimModuleSyntax` is on, so use `import type` for type-only imports.
- **Dynamic loading:** commands and events are discovered by scanning `dist/`, instantiating the **default export**. A file with no default export, or a command with no `data` property, is skipped with a warning and never runs.
- **Slash command deployment** happens on every startup. `NODE_ENV=development` registers against `DISCORD_GUILD_ID` (instant); anything else registers globally (up to an hour to propagate).

**Configuration & Secrets**
- `getConfig(name)` reads `/run/secrets/<lowercase-name>` first, then falls back to `process.env[name]`. This is the only way configuration is read.
- Secrets: Discord token, database password. Templates in `secrets_example/`.
- Non-secret config: client ID, guild ID, database name, `NODE_ENV`, LibreTranslate URL. Template in `.env.example`.
- Never put a real value in `.env.example` or `secrets_example/`.

**Database**
- PostgreSQL through Sequelize. `Database.connect()` retries every 5 seconds so the bot container can start before Postgres is ready.
- `sync({ alter: true })` means the models **are** the migration. Additive changes are safe; renames and type narrowing are destructive.
- Model attributes are declared twice (TypeScript interface and Sequelize `init`). Keep both in sync; the compiler cannot check this.

**Internationalization**
- Keys are dot-separated paths into nested JSON, resolved by `I18N.translate`, with `${name}` interpolation.
- `en` is the fallback locale. A key missing from `en.json` surfaces the raw key path to the user.
- Command handlers receive `t`, already bound to the guild's locale. Use it; do not call `I18N` directly from a command.

**Logging & Error Handling**
- `ShiveronLogger` writes to console and to `logs/`, with `debug` split into its own file.
- Levels: `info` for lifecycle, `warn` for recoverable or skipped, `error` for a failed operation, `debug` for per-item detail.
- Catch at the boundary where you can still act. A command that fails must reply to the user **and** log; a swallowed error leaves the interaction hanging until Discord times it out.
- Never log a token, password, or raw secret. `logs/` is user data.

**Testing Expectations**
- There is **no automated test suite yet**. Do not claim a change is tested on the basis of a successful build.
- Verification means: `npm run build` passes, lint and format pass, and the behaviour was exercised against a real guild, including failure paths (missing permissions, deleted channel, target outranking the bot).

**Linting**
- ESLint and Prettier are authoritative and enforced by CI. Tabs (width 4), single quotes, semicolons, trailing commas, 120-column width, Stroustrup braces, LF endings.
- `no-inline-comments` is an error: comments go **above** the line they explain.
- Do not add ESLint disable comments to silence a rule. Fix the code.

**Documentation Style**
- Formal, objective tone. No "we" or "you".
- Every exported class, method, and interface gets a TSDoc comment, with `@param` per parameter and `@returns` where a value is returned.
- Describe behaviour and invariants, not the signature.
- Do not wrap a comment across lines if it fits on one.

**Branching Strategy**
- **Development branch:** `dev`.
- **Releases branch:** `main`.
- **Large features:** feature branch off `dev` (e.g. `feat/slowmode`).

**General Coding Standards**
- **Commits:** Conventional Commits with a scope from `commands`, `events`, `services`, `models`, `core`, `utils`, `locales`, `docker`, `repo`.
- **Assets:** binary files live in `assets/` and are LFS-tracked. Add the extension to `.gitattributes` **before** the first commit of that type; retrofitting requires a history rewrite.
- **Forge:** development happens on Forgejo at `git.cryoforgenexus.com/Shiveron/shiveron`. GitHub is a read-only mirror. Link issues and PRs to Forgejo, never to GitHub.
