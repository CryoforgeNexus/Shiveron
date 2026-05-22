<div align="center">
  <img src="./shiveron_icon.png" height="300" alt="Shiveron Icon">
  <h1>Shiveron</h1>
  <p>A multipurpose and modular Discord bot</p>
  <img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/Cryoforge-Nexus/shiveron?style=flat">
  <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/Cryoforge-Nexus/shiveron?style=flat&color=green">
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Cryoforge-Nexus/shiveron?style=flat&color=aqua">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/Cryoforge-Nexus/shiveron?style=flat&color=yellow">
  <img alt="GitHub issues" src="https://img.shields.io/github/issues/Cryoforge-Nexus/shiveron?style=flat&color=red">
  <img alt="GitHub license" src="https://img.shields.io/github/license/Cryoforge-Nexus/shiveron?style=flat&color=silver">
  <br>
  <a href="https://patreon.com/Cryoforge_Nexus"><img alt="Patreon" src="https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white"></a>
</div>

## Features

- Moderation commands (ban, kick, timeout, purge, etc.)
- Temporary voice channels with a menu allowing users to change the properties of their own voice channel
- Stores user infractions in a dedicated database
- Allows moderators to quickly view a user's infraction history
- Message translation via auto-detection, flag emoji reactions, or the `/translate` command based on local language models
- Internationalization (i18n) support — currently English, French, and German
- And much more to come!

## Public Hosted Version

You can invite the public version of Shiveron using [this link](https://discord.com/oauth2/authorize?client_id=1305623177753526282&permissions=8&integration_type=0&scope=applications.commands+bot).  
The bot is hosted by Cryoforge Nexus, and we try to ensure it stays up 24/7.

## Requirements

- **Discord Bot Token** : Available from the [Discord Developer Portal](https://discord.com/developers/applications) under the "Bot" tab
- **Discord Client ID** : Found in the "General Information" tab of the [Discord Developer Portal](https://discord.com/developers/applications)
- **Docker** : Download from the [official website](https://www.docker.com)

## Installation

### 1. Creating a Discord Bot Application

If you haven't already, create a Discord application at the [Discord Developer Portal](https://discord.com/developers/applications).  
Then, create a bot account within the application and reset its token to copy it.

To invite your bot to a server :

- Go to the **OAuth2** tab
- Under **OAuth2 URL Generator**, check `application.commands` and `bot`
- In the **permissions** section, check `Administrator`
- Copy the generated link and open it in your browser to invite the bot to your server

### 2. Installing and Running Shiveron

Once your bot is ready, follow these steps :

- Download the [latest release](https://github.com/Cryoforge-Nexus/shiveron/releases)
- Extract the files from the downloaded archive
- The following step differs depending on your os :
    - **Linux users :** Run the file `linux_setup_and_run.sh` **in your terminal** by typing the following after navigating to the directory where you extracted the bot files :
        ```bash
        chmod +x linux_setup_and_run.sh
        ./linux_setup_and_run.sh
        ```
    - **Windows users :** we couldn't make a working script to run the bot, so you'll have to do it manually. Don't worry, it's not that deep. 
      - First, simply fill in the required fields of the file `.env.example`, and then rename it to `.env`. 
      - Then you need to also fill in the files in the folder `secrets_example` with the content that corresponds to their name, and rename that folder to `secrets`. 
      - Finally, you simply have to do the following commands to start and stop the bot :
      ```cmd
        docker compose up -d --build
        docker compose stop
      ```

> [!NOTE]
> The first startup may take a few minutes, as the translation language models need to be downloaded before the bot can start. You can monitor the progress with `docker compose logs`.

## Adding Features

Shiveron provides an easy-to-use API, allowing developers to create or modify its features. You must first install [NodeJS](https://nodejs.org/fr/download), and then install all the project dependencies :

```bash
npm install
```

Now, you can start coding ! Here's what you can change easily :

- **Commands** : Stored in `src/commands/` under subfolders by category. Remove a feature by simply deleting the file. Add a new one by creating a TypeScript file with a class extending `BaseCommand`.
- **Events** : Stored in `src/events/`. Remove a feature by deleting the file or commenting out its function call in the `execute` method. Add a new event by creating a TypeScript file extending `BaseCommand` and filling in all required fields, especially the event name (refer to the [official Discord.js documentation](https://discord.js.org/docs/packages/discord.js/14.24.2/ClientEvents:Interface)).

## Contributing

Feel free to [fork](https://github.com/Cryoforge-Nexus/shiveron/fork) this repository and open a pull request against the `dev` branch.
Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting, it covers the branch strategy, code style, and what's expected from a pull request.
If you encounter any issues, please report them [here](https://github.com/Cryoforge-Nexus/shiveron/issues).
If you enjoy this project, you can support us on [Patreon](https://patreon.com/Cryoforge_Nexus) !
