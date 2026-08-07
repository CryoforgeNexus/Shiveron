#!/usr/bin/env bash
# Verifies that every LFS-tracked path is committed as a Git LFS pointer rather than as a raw binary.
#
# Requires a checkout performed without LFS smudging: a raw-committed binary is only distinguishable from a proper pointer at the object level, not in a smudged working tree.

set -eu

# Every tracked path whose .gitattributes filter resolves to lfs must be committed as an LFS pointer. A binary committed in its place (e.g. by a contributor without git-lfs installed) is the failure this guard catches.
should_be_lfs=$(git ls-files | git check-attr --stdin filter | sed -n 's/: filter: lfs$//p')

violations=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  first_line=$(git cat-file -p "HEAD:$f" | head -n1)
  if [ "$first_line" != "version https://git-lfs.github.com/spec/v1" ]; then
    violations="$violations $f"
  fi
done <<< "$should_be_lfs"

if [ -n "$violations" ]; then
  echo "::error::Files match an LFS pattern in .gitattributes but were committed as raw blobs instead of Git LFS pointers:"
  # Unquoted expansion is intentional: the accumulated list is split on whitespace back into individual paths.
  for f in $violations; do echo "  - $f"; done
  echo "Fix: install git-lfs, run 'git lfs install', then 're-add' each file with 'git add --renormalize <file>' and recommit."
  exit 1
fi

echo "All LFS-tracked files are stored as pointers."
