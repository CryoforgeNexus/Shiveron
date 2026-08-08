<div align="center">
  <img src="./assets/shiveron_icon.png" height="300" alt="Shiveron Icon">
  <h1>Shiveron</h1>
  <p>A multipurpose, modular Discord bot, built by <a href="https://cryoforgenexus.com">Cryoforge Nexus</a></p>
  <img alt="Release" src="https://img.shields.io/gitea/v/release/Shiveron/shiveron?gitea_url=https%3A%2F%2Fgit.cryoforgenexus.com&style=flat&label=release">
  <img alt="Open issues" src="https://img.shields.io/gitea/issues/open/Shiveron/shiveron?gitea_url=https%3A%2F%2Fgit.cryoforgenexus.com&style=flat&color=red">
  <img alt="Stars" src="https://img.shields.io/gitea/stars/Shiveron/shiveron?gitea_url=https%3A%2F%2Fgit.cryoforgenexus.com&style=flat&color=yellow">
  <img alt="Last commit" src="https://img.shields.io/gitea/last-commit/Shiveron/shiveron?gitea_url=https%3A%2F%2Fgit.cryoforgenexus.com&style=flat&color=aqua">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-silver?style=flat">
  <br>
  <a href="https://patreon.com/Cryoforge_Nexus"><img alt="Patreon" src="https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white"></a>
</div>

> [!NOTE]
> Shiveron is developed at [git.cryoforgenexus.com/Shiveron/shiveron](https://git.cryoforgenexus.com/Shiveron/shiveron). The GitHub repository is a read-only mirror: **issues and pull requests go to Forgejo**, not to GitHub.

## Features

- Moderation commands: ban, kick, timeout, warn, purge, and more
- Temporary voice channels, with a menu that lets users configure their own channel
- Infraction storage in a dedicated database, with a quick history view for moderators
- Message translation through auto-detection, flag emoji reactions, or the `/translate` command, served by a self-hosted LibreTranslate instance
- Internationalization, currently English, French, and German
- And much more to come

## Public hosted version

Invite the public instance of Shiveron with [this link](https://discord.com/oauth2/authorize?client_id=1305623177753526282&permissions=8&integration_type=0&scope=applications.commands+bot). It is hosted by Cryoforge Nexus, and we do our best to keep it up around the clock.

Using the hosted instance means per-guild configuration is stored on our infrastructure. The [privacy policy](https://cryoforgenexus.com/privacy) and [terms of service](https://cryoforgenexus.com/terms) cover what is collected, why, and how to have it deleted. Self-hosting keeps all of it on your own machine instead.

## Requirements

- **Discord bot token**: available from the [Discord Developer Portal](https://discord.com/developers/applications) under the "Bot" tab
- **Discord client ID**: found in the "General Information" tab of the [Discord Developer Portal](https://discord.com/developers/applications)
- **Docker**: available from the [official website](https://www.docker.com)

## Installation

### 1. Create a Discord bot application

Create an application at the [Discord Developer Portal](https://discord.com/developers/applications) if you do not have one yet, then create a bot account within it and reset its token so you can copy it.

To invite the bot to a server:

- Open the **OAuth2** tab
- Under **OAuth2 URL Generator**, check `applications.commands` and `bot`
- In the **permissions** section, check `Administrator`
- Copy the generated link and open it in a browser to invite the bot

### 2. Install and run Shiveron

- Download the [latest release](https://git.cryoforgenexus.com/Shiveron/shiveron/releases)
- Extract the archive
- The next step depends on your operating system:
    - **Linux**: run `linux_setup_and_run.sh` **in a terminal**, from the directory you extracted the files into:
        ```bash
        chmod +x linux_setup_and_run.sh
        ./linux_setup_and_run.sh
        ```
    - **Windows**: there is no working setup script yet, so the steps are manual. It is not much work:
        - Fill in the required fields of `.env.example`, then rename the file to `.env`
        - Fill in each file in `secrets_example/` with the value its name describes, then rename the folder to `secrets`
        - Start and stop the bot with:
        ```cmd
        docker compose up -d --build
        docker compose stop
        ```

> [!NOTE]
> The first startup takes a few minutes, because the translation language models are downloaded before the bot can start. The bot container stays idle until LibreTranslate reports itself healthy, so it logs nothing during that time. Watch `docker compose ps` for the LibreTranslate container to turn healthy, then follow the bot with `docker compose logs -f`.

## Contributing

Shiveron is built to be extended: commands and events are self-contained files, so adding a feature or stripping one out is a matter of adding or deleting a file.

- [CONTRIBUTING.md](CONTRIBUTING.md) covers the process: where development happens, branch strategy, commit conventions, and what a pull request needs.
- [DEVELOPMENT.md](DEVELOPMENT.md) is the engineering manual: architecture, layering rules, how to add a command or an event, and how to build and run the project locally.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) applies to everyone taking part.

Found a bug? [Open an issue](https://git.cryoforgenexus.com/Shiveron/shiveron/issues) with what happened, what you expected, and how to reproduce it. For anything security-related, follow [SECURITY.md](SECURITY.md) instead.

If you enjoy the project, you can support us on [Patreon](https://patreon.com/Cryoforge_Nexus).

## License

Shiveron is released under the [MIT License](LICENSE).
