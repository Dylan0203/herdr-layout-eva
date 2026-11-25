# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.2] - 2026-11-26

_tracks tag `v0.10.2`_

### Fixed
- OpenCode agent cards show their context window again instead of `---.-`, because the models.dev catalog lookup now matches the cache key of any version (as in opencode 2.4.1's `models-dev:v3:catalog`).

## [0.10.1] - 2026-11-25

_tracks tag `v0.10.1`_

### Fixed
- OpenCode agent cards show their sync rate again: current OpenCode no longer writes models.json, so the context window is now read from the model catalog in OpenCode's own database, and older versions still use the cache file.
