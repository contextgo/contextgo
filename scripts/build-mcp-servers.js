#!/usr/bin/env node
/**
 * Placeholder build step kept for compatibility with existing package scripts.
 * ContextGo no longer bundles built-in MCP server entry points here.
 */

async function main() {
  console.log('No built-in MCP servers to bundle.');
}

main().catch((err) => {
  console.error('MCP server build failed:', err);
  process.exit(1);
});
