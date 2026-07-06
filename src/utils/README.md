# src/utils

**Responsibility:** Pure, shared utility functions.

This module contains functions that are used by two or more other modules and that carry no domain knowledge. Every function here must be pure (no side effects, deterministic output) or clearly documented if it cannot be.

## What belongs here

- Path manipulation helpers.
- String formatting utilities.
- Generic retry logic (independent of the AI module).
- File existence checks or other thin wrappers around Node.js built-ins that are used repeatedly.

## What does NOT belong here

- Any function that is only used in one module — keep it there.
- Domain logic (anything that knows about `Config`, `RepositorySnapshot`, etc.).
- Functions with side effects that belong in a specific module.

## Current status

Not yet implemented. Placeholder for shared utilities.

## Guidelines

Before adding a function here, ask: "Would a different project with completely different business logic find this useful?" If yes, it belongs here. If no, it belongs in the calling module.
