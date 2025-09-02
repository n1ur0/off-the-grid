# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Off the Grid is a decentralized grid trading application built on the Ergo blockchain. It implements automated grid trading orders using smart contracts while allowing users to retain control of their funds. The application includes both a CLI interface and a matching bot that arbitrages between grid orders and liquidity sources (primarily Spectrum AMMs).

## Architecture

This is a Rust workspace with a single CLI package:

### Core Components

- **CLI (`cli/`)**: Main command-line application with subcommands for:
  - `grid`: Create, redeem, list, and view details of grid trading orders
  - `scans`: Manage Ergo node scan configurations
  - `matcher`: Run the automated matching bot
  - `tokens`: Fetch and update token information from Spectrum pools

- **Node Integration (`cli/src/node/`)**: HTTP API client for Ergo node communication
  - `client.rs`: Core HTTP client for node API
  - `wallet.rs`: Wallet operations and management
  - `transactions.rs`: Transaction building and submission
  - `scan.rs`: Blockchain scanning functionality

- **Grid Orders (`cli/src/grid/`)**: Grid trading logic and multi-grid order management
- **Spectrum Integration (`cli/src/spectrum/`)**: Integration with Spectrum AMM pools for liquidity matching
- **Box Management (`cli/src/boxes/`)**: Ergo box (UTXO) handling and tracking

### Smart Contracts

- **Grid Multi Contract (`contracts/grid_multi/`)**: ErgoScript contract that enforces grid trading rules and allows spending only with correct order fills or owner signatures

## Build Commands

**Nix (Recommended):**
```bash
nix build
# Executable: ./result/bin/off-the-grid
```

**Cargo:**
```bash
cargo build                    # Debug build
cargo build --release         # Release build
# Executables in ./target/debug/ or ./target/release/
```

**Test:**
```bash
cargo test
```

**Lint/Format:**
```bash
cargo clippy
cargo fmt
```

## Configuration Files

- `node_config.json`: Ergo node API configuration (URL, API key)
- `matcher_config.json`: Matcher bot configuration (reward address, interval)
- `scan_config.json`: Generated scan IDs for tracking blockchain state

## Essential Setup Steps

1. Configure Ergo node connection in `node_config.json`
2. Set up wallet on the Ergo node (required even for matcher)
3. Generate scan configuration: `off-the-grid scans create-config`
4. Optionally fetch token info: `off-the-grid tokens update`

## Development Environment

The project uses a Nix flake that includes:
- Rust 1.87.0 toolchain
- ErgoScript compiler tools (`escompile`, `es2ergotree`)
- Required system dependencies (OpenSSL, pkg-config)

## Key Dependencies

- `ergo-lib`: Ergo blockchain integration
- `tokio`: Async runtime
- `reqwest`: HTTP client for node API
- `clap`: CLI argument parsing
- `serde`/`serde_json`: Serialization