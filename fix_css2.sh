#!/usr/bin/env bash
shopt -s globstar nullglob
vars=("outline" "on-surface" "accent" "surface-container" "surface-container-high" "on-primary")
denoms=(5 8 12 15 20 25 30 35 40 42 45 50 55 60 70)
for f in src/components/**/*.tsx; do
  for v in "${vars[@]}"; do
    for n in "${denoms[@]}"; do
      # Avoid if already replaced (safe anyway)
      sed -i "s/var(--$v)\/$n/rgba(var(--${v}-rgb), $((n))/100)/g" "$f"
    done
  done
done
