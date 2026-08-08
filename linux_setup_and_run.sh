#!/bin/bash
set -e

CYAN="\e[36m"
RESET="\e[0m"

ENV_CREATED=false
SECRETS_CREATED=false

if [ -d secrets_example ]; then
    echo -e "${CYAN}Creating the secrets directory ...${RESET}"

    mkdir secrets
    SECRETS_CREATED=true

    prompt_secret() {
        local file_name="$1"
        local prompt_text="$2"
        local file_path="secrets/$file_name.txt"

        read -p "$(echo -e "${CYAN}$prompt_text:${RESET} ")" value
        echo "$value" > "$file_path"
    }

    echo -e "${CYAN}Please enter the following values:${RESET}"
    prompt_secret "discord_token" "Discord Bot Token"
    prompt_secret "db_pass" "Database Password"
else
    echo -e "${CYAN}secrets_example folder not found, assuming secrets were already configured.${RESET}"
fi


if [ -f .env.example ]; then
    echo -e "${CYAN}Creating the .env configuration ...${RESET}"

    cp .env.example .env
    ENV_CREATED=true

    prompt_env() {
        local key="$1"
        local prompt_text="$2"
        read -p "$(echo -e "${CYAN}$prompt_text:${RESET} ")" value
        sed -i "s|^$key=.*|$key=$value|" .env
    }

    echo -e "${CYAN}Please enter the following values:${RESET}"
    prompt_env "DB_NAME" "Database Name"
    prompt_env "DB_USER" "Database User"
    prompt_env "DISCORD_CLIENT_ID" "Discord Client ID"
    prompt_env "DISCORD_GUILD_ID" "Discord Guild ID (leave empty if you do not plan on adding features)"

    while true; do
        read -p "$(echo -e "${CYAN}Is this bot running in production mode? (Y/n):${RESET} ")" yn
        yn=${yn:-y}
        case $yn in
            [Yy]* ) sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env; break;;
            [Nn]* ) sed -i "s|^NODE_ENV=.*|NODE_ENV=development|" .env; break;;
            * ) echo -e "${CYAN}Please answer y or n.${RESET}";;
        esac
    done

    prompt_env "LT_THREADS" "CPU threads LibreTranslate may use for translation (leave empty for 4)"

    # Left commented out in .env.example when no answer is given: LibreTranslate reads an empty value as the language code "", installs no models and refuses to start.
    read -p "$(echo -e "${CYAN}Languages LibreTranslate should load, comma-separated, e.g. en,fr,de (leave empty for all):${RESET} ")" lt_load_only
    if [ -n "$lt_load_only" ]; then
        sed -i "s|^# LT_LOAD_ONLY=.*|LT_LOAD_ONLY=$lt_load_only|" .env
    fi
else
    echo -e "${CYAN}.env.example not found, assuming .env was already configured.${RESET}"
fi

echo -e "${CYAN}Rebuilding and starting containers...${RESET}"
docker compose up -d --build

if [ "$ENV_CREATED" = true ]; then
    rm .env.example
fi

if [ "$SECRETS_CREATED" = true ]; then
    rm -r secrets_example/
fi

echo -e "${CYAN}Bot is running in detached mode.${RESET}"
echo -e "${CYAN}Use 'docker compose logs -f' to view logs and 'docker compose stop' to stop both the bot and database.${RESET}"
echo -e "${CYAN}To change the environment values or the secrets, edit the '.env' file and the files present in './secrets/' respectively as this script will now start the bot directly.${RESET}"
