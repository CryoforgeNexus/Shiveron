# Development Guidelines

This file is the single source of truth for architecture, conventions, and workflow for contributors working on Shiveron.

## Documentation map

Documentation is layered by altitude. Keep content at the layer it belongs to, so no single file ends up hoarding everything.

- **[`README.md`](README.md)**: for people who want to *run* Shiveron. What it does, how to invite the hosted instance, how to self-host it. No engineering content.
- **[`CONTRIBUTING.md`](CONTRIBUTING.md)**: the *process*. Where development happens, branch strategy, commit conventions, what a pull request must contain.
- **This file (`DEVELOPMENT.md`)**: the *engineering manual*. Architecture, cross-cutting conventions, and the invariants that hold no matter which feature is being touched. There is a finite set of these, so this file should grow slowly.
- **TSDoc comments in the source (`/** ... */`)**: how an individual class or function actually works. Implementation detail lives next to the code, not here.

## Project layout

Shiveron is a single TypeScript package targeting Node.js, built with `tsc` and deployed as a Docker Compose stack. Everything under `src/` compiles to `dist/`, which is what actually runs.

- `src/bot.ts`: entry point. Constructs a `ShiveronClient` and starts it. Deliberately trivial.
- `src/core/`: the framework layer. `ShiveronClient` (the discord.js client, plus command/event loading and slash-command deployment), `BaseCommand` and `BaseEvent` (the contracts every feature implements), `Database` (Sequelize connection and model init), `I18N` (locale loading and key resolution), `ShiveronLogger` (console and file logging).
- `src/commands/`: one file per slash command, grouped into subfolders by category (`moderation/`, `setup/`, `utility/`). The subfolder name is organizational only; the loader walks every subfolder.
- `src/events/`: one file per Discord gateway event handler.
- `src/services/`: all database and external-API access. Commands and events call services; they never touch models or `fetch` directly.
- `src/models/`: Sequelize model definitions, one per table.
- `src/utils/`: pure helpers with no Discord or database state. `discord/` holds helpers that do take discord.js types but hold no state of their own.
- `src/locales/`: one JSON file per supported language, copied into `dist/locales/` by the build.
- `assets/`: binary project assets (icon, artwork). Tracked with Git LFS.
- `docker/`: `Dockerfile` and container entrypoint.
- `secrets_example/`: templates for the Docker secret files. Copy to `secrets/`, which is gitignored.

## Layering rules

The dependency direction is one-way, and keeping it that way is what makes commands cheap to add and delete:

```
commands / events  →  services  →  models  →  database
        ↓                ↓
      utils            utils
```

- **Commands and events** own Discord interaction handling: parsing options, permission checks, building embeds, replying. They hold no persistent state.
- **Services** own everything that talks to the outside world: the database and the LibreTranslate API. A service takes a logger in its constructor and returns plain data or model instances.
- **Models** own the schema. They are Sequelize `Model` subclasses with an `initialize(sequelize)` static, called once from `Database`.
- **Utils** must stay dependency-light. Do not import a service or a model from `src/utils/`.

Never reach past a layer. A command that queries a model directly is the change most likely to be sent back in review.

## Adding a command

Create a TypeScript file in the matching subfolder of `src/commands/`, exporting a class that extends `BaseCommand` as its **default export**. The loader imports every `.js` file under `dist/commands/*/`, instantiates the default export, and skips anything without a `data` property, logging a warning.

A command supplies two things:

- `data`: a `SlashCommandBuilder` describing the command as Discord sees it.
- `execute(client, interaction, t)`: the handler. `t` is the translation function, already bound to the guild's configured locale.

Implement the optional `autocomplete(client, interaction)` method only if the command declares autocomplete options.

Commands are deployed to Discord on every startup. In `development` mode they register against `DISCORD_GUILD_ID` only, which propagates instantly; otherwise they register globally, which Discord can take up to an hour to roll out. Use the guild path while iterating.

## Adding an event

Create a TypeScript file in `src/events/`, exporting a class that extends `BaseEvent<K>` as its default export, where `K` is a key of discord.js' `ClientEvents`. It must declare:

- `name`: the gateway event name, which must match `K`.
- `once`: whether the handler fires once or on every occurrence.
- `execute(client, ...args)`: the handler, with `args` typed by discord.js for that event.

If a new event requires a gateway intent that is not already requested, add it to the intents array in the `ShiveronClient` constructor. A missing intent fails silently: the event simply never fires, which is a slow bug to find.

## Internationalization

Every user-visible string goes through the i18n layer. There are no exceptions, including error messages and ephemeral replies.

- Add the key to `src/locales/en.json` **and to every other locale file**. English is the fallback, so a key missing elsewhere degrades to English, but a key missing from `en.json` degrades to the raw key path being shown to the user.
- Keys are dot-separated paths into the nested JSON (`command.ban.success_temporary`), resolved by `I18N.translate`.
- Interpolation uses `${name}` placeholders, filled from the `vars` object.
- Keep the key hierarchy mirroring the code structure (`command.<name>.<case>`), so an unused key is easy to spot when a command is deleted.

## Configuration and secrets

Configuration is read through `getConfig(name)` in `src/utils/config.ts`, which checks `/run/secrets/<lowercase-name>` first and falls back to `process.env[name]`. This is what lets the same code path serve a Docker secret in production and a plain environment variable in local development.

- **Secrets** (the Discord token, the database password) are mounted as Docker secrets and must never be read from `.env`. Templates live in `secrets_example/`.
- **Non-secret configuration** (client ID, guild ID, database name, `NODE_ENV`, LibreTranslate URL) lives in `.env`, templated by `.env.example`.
- Neither `.env` nor `secrets/` is ever committed. Both are gitignored, and adding a real value to `.env.example` is a leak.

## Database

PostgreSQL through Sequelize. `Database.connect()` authenticates, then runs `sync({ alter: true })` and retries every five seconds until the database is reachable, which is what lets the bot container start before Postgres is ready.

- `sync({ alter: true })` means **the models are the migration**. Adding a column to a model applies it on the next boot. This is convenient and it is also a footgun: renaming a field drops the old column and its data. Treat any destructive schema change as needing a deliberate migration plan, not a model edit.
- Model files declare their attributes twice, once as a TypeScript interface and once in the Sequelize `init` call. Keep them in sync; the compiler cannot check this for you.
- Query only from services.

## Logging and error handling

- Use `client.logger` (`ShiveronLogger`), never `console.log`. It writes timestamped lines to both the console and `logs/`, splitting `debug` output into its own file.
- Levels: `info` for lifecycle events, `warn` for a recoverable problem or a skipped item, `error` for a failed operation, `debug` for per-item detail that would be noise in normal operation.
- Catch at the boundary where you can still do something useful. A command that fails should reply to the user *and* log; swallowing the error leaves the interaction hanging until Discord times it out.
- Never log a token, a password, or a raw secret value. `logs/` is user data and is treated as such in [SECURITY.md](SECURITY.md).

## TypeScript conventions

`tsconfig.json` runs in strict mode with the additional checks turned on, including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals`, and `noPropertyAccessFromIndexSignature`. These are deliberate. Do not relax them to make a specific change compile.

- The project is **ESM**. Relative imports must carry the `.js` extension, even in `.ts` source, because that is what the emitted output resolves.
- Prefer `import type` for type-only imports; `verbatimModuleSyntax` is on.
- Avoid `any`. It appears in the existing i18n and event-loading code where genuinely unavoidable; it is not a precedent to extend.
- Avoid non-null assertions (`!`). Where the existing code uses them around config lookups, narrow the value instead when you touch that code.
- Magic numbers belong in `src/utils/constants.ts`, named and grouped, not inlined into a handler.

## Documentation style

- **Objective tone.** Doc comments and inline comments are written in a neutral, formal register.
- **No personal pronouns.** Avoid "we", "our", "you", "your". Prefer "The buffer is initialized" over "We initialize the buffer".
- **Every exported class, method, and interface gets a TSDoc comment** describing what it does, with `@param` for each parameter and `@returns` where a value is returned. This is the existing standard across `src/`; match it.
- **Focus on behaviour and invariants**, not on restating the signature.
- **Do not wrap comments artificially.** If a comment fits on one line, leave it on one line. Break across lines only when the content is genuinely long.
- Inline comments (`//`) go **above** the line they explain. ESLint enforces this: `no-inline-comments` is an error.

## Code style

ESLint and Prettier are authoritative, and CI enforces both. The rules worth knowing before you write rather than after the linter tells you:

- **Tabs** for indentation, width 4. **Single quotes.** Semicolons required. Trailing commas everywhere. 120-column print width.
- Stroustrup brace style, `const` over `let`, no `var`.
- Maximum 4 nested callbacks and 2 statements per line.
- LF line endings, enforced by both Prettier and `.gitattributes`.

## Assets and Git LFS

Binary assets live in `assets/` and are tracked with [Git LFS](https://git-lfs.com). Run `git lfs install` once before cloning, then `git lfs pull` in an existing clone; without it, those files check out as pointer text.

The tracked extensions are declared in [`.gitattributes`](.gitattributes) and cover images, fonts, audio, and video. SVG is deliberately excluded: it is XML, and keeping it in regular Git preserves readable diffs. Add new binary formats to `.gitattributes` **before** committing the first file of that type, since retroactively converting a committed file requires a history rewrite.

## Development setup

### Prerequisites

- [Node.js](https://nodejs.org) 22 or newer
- [Docker](https://www.docker.com) with Compose, for the full stack
- [Git LFS](https://git-lfs.com), for the assets

### Building

```bash
git clone https://git.cryoforgenexus.com/Shiveron/shiveron.git
cd shiveron
git lfs pull
npm install
npm run build
```

`npm run build` wipes `dist/`, runs `tsc`, and copies `src/locales/` into `dist/locales/`. The locale copy is a build step, not a compile output, so a locale change requires a rebuild to take effect.

### Running

The bot needs a database and a translation backend, so the practical way to run it is the full Compose stack:

```bash
docker compose up -d --build
docker compose logs -f
docker compose stop
```

The first startup downloads the LibreTranslate language models and takes several minutes.

Set `NODE_ENV=development` and `DISCORD_GUILD_ID` in `.env` while iterating, so slash commands register against a single test guild instead of globally.

### Linting

CI runs both checks on every pull request and blocks the merge if either fails. Run them locally first:

```bash
npm run lint
npm run format:check
```

To apply the fixes:

```bash
npm run lint:fix
npm run format
```

### Testing

There is no automated test suite yet. Until there is, "tested" means the change was exercised against a real Discord guild, including its failure paths (missing permissions, deleted channel, target user outranking the bot). Say so explicitly in the pull request description.
