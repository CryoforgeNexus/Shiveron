#!/usr/bin/env bash
# Prints one release section of CHANGELOG.md, for use as the body of a Forgejo release.
#
# Usage: extract-changelog.sh <tag> [title|body]
#
# A section runs from its own "## [<tag>]" heading to the next "## [" heading. The tag must already have a section: a release whose notes were never written is a mistake worth failing the workflow over, not an empty release to be published and fixed afterwards.

set -eu

tag="${1:-}"
part="${2:-body}"

if [ -z "$tag" ]; then
  echo "::error::usage: extract-changelog.sh <tag> [title|body]"
  exit 1
fi

changelog="$(dirname "$0")/../../CHANGELOG.md"

if [ ! -f "$changelog" ]; then
  echo "::error::CHANGELOG.md not found at $changelog"
  exit 1
fi

# awk rather than sed: the heading is matched as a literal prefix, so a tag containing regex metacharacters cannot alter the match.
section=$(awk -v heading="## [$tag]" '
  index($0, heading) == 1 { found = 1; print; next }
  found && index($0, "## [") == 1 { exit }
  found { print }
' "$changelog")

if [ -z "$section" ]; then
  echo "::error::CHANGELOG.md has no '## [$tag]' section. Add the release notes before tagging."
  exit 1
fi

case "$part" in
  title)
    # "## [v1.2.0] — Message translation" becomes "v1.2.0 — Message translation", which is how the existing releases are titled.
    printf '%s\n' "$section" | head -n1 | sed -e 's/^## \[//' -e 's/\] / /' -e 's/\]$//'
    ;;
  body)
    # Drop the heading, then the blank lines that surround the section, leaving the "### Added" groups as written.
    printf '%s\n' "$section" | tail -n +2 | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
    ;;
  *)
    echo "::error::unknown part '$part': expected 'title' or 'body'"
    exit 1
    ;;
esac
