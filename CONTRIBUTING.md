# Contributing to Shiveron

Thanks for your interest in contributing. This guide covers where development happens, how a change gets from your machine into `dev`, and what is expected of a pull request.

For architecture, layering rules, and how to actually add a command or an event, see [DEVELOPMENT.md](DEVELOPMENT.md). This file is the process; that one is the engineering manual.

## Where development happens

Shiveron is developed on Cryoforge Nexus' Forgejo instance at [git.cryoforgenexus.com/Shiveron/shiveron](https://git.cryoforgenexus.com/Shiveron/shiveron).

The GitHub repository is a **read-only mirror** kept for discoverability. Issues and pull requests opened there are not watched. Register an account on the Forgejo instance and work from there instead.

## Branch strategy

Shiveron uses a two-branch workflow:

- **`main`**: stable, tagged releases only
- **`dev`**: the active development branch, where all work lands

Always branch off `dev` and target `dev` in your pull requests. Never open a pull request directly against `main`.

## Getting started

1. Fork the repository on [Forgejo](https://git.cryoforgenexus.com/Shiveron/shiveron)
2. Clone your fork and install the dependencies:
    ```bash
    git lfs install
    git clone https://git.cryoforgenexus.com/your-username/shiveron.git
    cd shiveron
    npm install
    ```
3. Create a feature branch from `dev`:
    ```bash
    git checkout dev
    git checkout -b feat/your-feature-name
    ```
4. Make your changes, push, and open a pull request against `dev`

Binary assets live in `assets/` and are stored in [Git LFS](https://git-lfs.com). Without `git lfs install`, they check out as small text pointers instead of real files. In an existing clone, run `git lfs pull` to fetch them.

Full build and run instructions are in [DEVELOPMENT.md](DEVELOPMENT.md#development-setup).

## Code style

ESLint and Prettier are authoritative. CI runs both checks on every pull request, and a pull request cannot be merged until they pass:

```bash
npm run lint
npm run format:check
```

CI only reports failures, it does not fix anything. When a check fails, apply the fixes yourself:

```bash
npm run lint:fix
npm run format
```

The conventions behind those rules are documented in [DEVELOPMENT.md](DEVELOPMENT.md#code-style). Keep changes focused: one feature or fix per pull request stays easy to review.

## Commit conventions

Shiveron uses [Conventional Commits](https://www.conventionalcommits.org/) with a scope naming the area you touched.

Format:

```
<type>(<scope>): <imperative subject>

[optional body]
```

- **Type** (required, exactly one): `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`. Append `!` before the colon for a breaking change: `feat(commands)!: ...`.
- **Scope** (required): the area the change primarily affects, one of `commands`, `events`, `services`, `models`, `core`, `utils`, `locales`, `docker`, or `repo` for repository-wide changes such as CI or `.gitattributes`.
- **Subject**: imperative mood ("add", not "added"), lowercase, no trailing period, under 72 characters.
- **Body**: usually unnecessary. The exception is a `fix` for a non-obvious bug, where explaining the root cause and why the fix works is worth the lines.

Examples:

```
feat(commands): add slowmode command
fix(services): release the voice lock when channel creation fails
refactor(core): split command loading out of ShiveronClient
chore(repo): bump discord.js to 14.26
docs(repo): document the git lfs setup step
```

Keep commits scoped to a single concept. If a commit needs the word "and" to describe it, it is probably two commits.

## Pull request quality

Vibe-coded pull requests are not accepted. If you submit code, you should understand what it does and be able to explain it in review. AI-assisted contributions are fine, provided you have reviewed and tested the result and genuinely stand behind it. If you cannot answer questions about your own diff, the contribution will be closed.

Before opening a pull request:

1. **Verify** the change is actually present and correct in your working tree, with `git diff`. Do not assume.
2. **Run the linter and formatter**: `npm run lint` and `npm run format:check`.
3. **Build it**: `npm run build` must succeed. TypeScript runs in strict mode, so a type error is a real error, not a nuisance to work around.
4. **Test it against a real guild.** Discord behaviour, permissions, and gateway intents are not covered by static checks, and there is no automated test suite yet. Exercise the failure paths too: missing permissions, deleted channel, target user outranking the bot.
5. **Describe the change**: what it does, why it is needed, and any design decision you made. Link related issues, and state how you tested it.

## Reporting issues

Open an issue [on Forgejo](https://git.cryoforgenexus.com/Shiveron/shiveron/issues) with as much detail as you can give: what happened, what you expected, how to reproduce it, and which version you are running.

For anything security-related, do **not** open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Conduct

Everyone taking part in this project is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

If you enjoy the project, you can support us on [Patreon](https://patreon.com/Cryoforge_Nexus).
