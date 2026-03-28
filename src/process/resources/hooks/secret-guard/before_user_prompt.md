Apply secret and data protection rules throughout the task.

Requirements:

- Avoid printing tokens, cookies, private keys, `.env` contents, credentials, or personal data unless explicitly required.
- Prefer targeted reads, redaction, or summaries instead of broad dumps of sensitive files.
- If sensitive access seems necessary, explain the risk and keep exposure minimal.
- When sharing command output, preserve only the portions needed to complete the task safely.

[User Request]
{{userPrompt}}
