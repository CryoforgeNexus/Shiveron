# Security Policy

## Supported versions

Only the latest release of Shiveron receives security fixes. If you are running an older version, update before reporting.

## Reporting a vulnerability

Report vulnerabilities privately to **[security@cryoforgenexus.com](mailto:security@cryoforgenexus.com)**.

**Do not open a public issue.** Forgejo issues are public, and so is every other tracker on this project. A public report gives every operator of a self-hosted instance a working exploit before there is a patch for it.

Include as much as you can: what the vulnerability is, how to reproduce it, which version you tested, and what the impact could be. A proof of concept helps, but a clear description of the mechanism is worth more than a script.

What to expect:

- **Acknowledgement within 72 hours.** If you do not hear back in that window, assume the mail did not arrive and follow up through [Patreon](https://patreon.com/Cryoforge_Nexus).
- **An assessment within a week**, including whether we agree on the severity.
- **Credit in the release notes** for the fix, unless you would rather stay anonymous.

Please give us a reasonable window to ship a fix before disclosing publicly. Ninety days is the default; if the issue is being actively exploited, tell us and we will move faster.

## Scope

In scope: the bot in this repository, and the instance hosted by Cryoforge Nexus.

Out of scope: vulnerabilities in Discord itself, which belong to [Discord's own program](https://discord.com/security), and vulnerabilities in our upstream dependencies, which should go to those projects first. If a dependency issue is exploitable *specifically* through how Shiveron uses it, that is in scope and worth reporting here.

> [!WARNING]
> Shiveron is invited with `Administrator` permissions. Anything that could lead to unauthorized command execution, privilege escalation, or a moderator-only action being triggered by a non-moderator should be treated as high severity.

## Self-hosting notes

If you run your own instance, these are yours to get right:

- The bot token and the database password are read from Docker secrets, not from `.env`. Keep the `secrets/` directory out of version control; it is already gitignored.
- The bundled LibreTranslate container runs with no API key and is reachable only on the internal Compose network. Do not publish its port.
- The PostgreSQL container is likewise unpublished. Keep it that way.
- `logs/` can contain guild IDs, user IDs, and message content passed through translation. Treat it as user data: it is subject to the same handling as anything else your users entrust to you.
