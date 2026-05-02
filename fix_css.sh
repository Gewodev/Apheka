#!/usr/bin/env bash
shopt -s globstar nullglob
for f in src/components/**/*.tsx; do
  echo "Processing $f..."
  # Outline opacity patterns
  sed -i "s/var(--outline)\/10/rgba(var(--outline-rgb), 0.1)/g" "$f"
  sed -i "s/var(--outline)\/12/rgba(var(--outline-rgb), 0.12)/g" "$f"
  sed -i "s/var(--outline)\/15/rgba(var(--outline-rgb), 0.15)/g" "$f"
  sed -i "s/var(--outline)\/20/rgba(var(--outline-rgb), 0.2)/g" "$f"
  sed -i "s/var(--outline)\/30/rgba(var(--outline-rgb), 0.3)/g" "$f"
  sed -i "s/var(--outline)\/40/rgba(var(--outline-rgb), 0.4)/g" "$f"
  sed -i "s/var(--outline)\/60/rgba(var(--outline-rgb), 0.6)/g" "$f"
  sed -i "s/var(--outline)\/8/rgba(var(--outline-rgb), 0.08)/g" "$f"
  # On-surface opacity patterns
  sed -i "s/var(--on-surface)\/30/rgba(var(--on-surface-rgb), 0.3)/g" "$f"
  sed -i "s/var(--on-surface)\/35/rgba(var(--on-surface-rgb), 0.35)/g" "$f"
  sed -i "s/var(--on-surface)\/40/rgba(var(--on-surface-rgb), 0.4)/g" "$f"
  sed -i "s/var(--on-surface)\/50/rgba(var(--on-surface-rgb), 0.5)/g" "$f"
  sed -i "s/var(--on-surface)\/60/rgba(var(--on-surface-rgb), 0.6)/g" "$f"
  sed -i "s/var(--on-surface)\/70/rgba(var(--on-surface-rgb), 0.7)/g" "$f"
  # Accent opacity patterns
  sed -i "s/var(--accent)\/10/rgba(var(--accent-rgb), 0.1)/g" "$f"
  sed -i "s/var(--accent)\/20/rgba(var(--accent-rgb), 0.2)/g" "$f"
  sed -i "s/var(--accent)\/25/rgba(var(--accent-rgb), 0.25)/g" "$f"
  sed -i "s/var(--accent)\/30/rgba(var(--accent-rgb), 0.3)/g" "$f"
  sed -i "s/var(--accent)\/40/rgba(var(--accent-rgb), 0.4)/g" "$f"
  sed -i "s/var(--accent)\/60/rgba(var(--accent-rgb), 0.6)/g" "$f"
  # Surface-container opacity patterns
  sed -i "s/var(--surface-container)\/40/rgba(var(--surface-container-rgb), 0.4)/g" "$f"
  sed -i "s/var(--surface-container-high)\/40/rgba(var(--surface-container-high-rgb), 0.4)/g" "$f"
done
