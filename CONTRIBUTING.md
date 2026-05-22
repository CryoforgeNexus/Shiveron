# Contributing to Shiveron

Thanks for your interest in contributing ! Here's everything you need to know.

## Branch Strategy

Shiveron uses a two-branch workflow :

- **`main`** : stable, tagged releases only
- **`dev`** : the active development branch, this is where all work goes

Always branch off `dev`, and target `dev` in your pull requests. Never open a PR directly against `main`.

## Getting Started

1. [Fork](https://github.com/Cryoforge-Nexus/shiveron/fork) the repository
2. Clone your fork and install dependencies :
    ```bash
    git clone https://github.com/your-username/Shiveron.git
    cd Shiveron
    npm install
    ```
3. Create a feature branch from `dev` :
    ```bash
    git checkout dev
    git checkout -b feat/your-feature-name
    ```
4. Make your changes, then push and open a pull request against `dev`

## Adding Commands or Events

The project is designed to make this easy :

- **Commands** : create a TypeScript file in the appropriate subfolder under `src/commands/`, with a class extending `BaseCommand`
- **Events** : create a TypeScript file in `src/events/`, extending `BaseEvent` and filling in the required fields (especially the event name, refer to the [Discord.js docs](https://discord.js.org/docs/packages/discord.js/14.24.2/ClientEvents:Interface))

## Code Style

Shiveron uses ESLint and Prettier. CI runs the checks on every pull request and a PR cannot be merged until both pass :

```bash
npm run lint
npm run format:check
```

CI only reports failures, it does not fix anything. If a check fails, run the fixes yourself :

```bash
npm run lint:fix
npm run format
```

Keep your changes focused. One feature or fix per pull request keeps things clean and easy to review.

## Pull Request Quality

Vibe-coded pull requests will not be accepted. If you're submitting code, you should understand what it does and be able to explain it. AI-assisted contributions are fine as long as you've reviewed, tested, and actually stand behind the changes.

## Reporting Issues

Found a bug ? Please open an issue [here](https://github.com/Cryoforge-Nexus/shiveron/issues) with as much detail as possible, what happened, what you expected, and how to reproduce it.

## Support

If you enjoy the project, you can support us on [Patreon](https://patreon.com/Cryoforge_Nexus) !
