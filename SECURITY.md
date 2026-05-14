# Security Policy

## Reporting A Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Use GitHub Security Advisories for private reporting:

https://github.com/contextgo/contextgo/security/advisories/new

Include as much detail as you can safely share:

- affected version or commit
- operating system and install method
- reproduction steps
- expected and actual behavior
- impact assessment
- whether credentials, local files, remote access, or workspace data may be exposed

## Supported Versions

ContextGo is in early public development. Security fixes are prioritized for the latest `main` branch and the latest published stable release.

## Handling Secrets

Never attach tokens, cookies, private keys, `.env` files, databases, or real workspace archives to public issues. If a report requires sensitive material, describe the shape of the data first and wait for a private maintainer response in the advisory thread.

## Scope

Security-sensitive areas include:

- desktop host runtime access
- Official Remote device discovery and relay flows
- cloud authentication and device tokens
- WebUI sessions and upload flows
- connector credentials and external product access
- agent execution, workspace file access, and local command invocation
