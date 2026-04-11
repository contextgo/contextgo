---
name: using-git-worktrees
description: Use when risky or multi-step implementation should be isolated from the current repository checkout.
---

# Using Git Worktrees

Use isolation deliberately.

Workflow:

1. Confirm the workspace is inside a git repository and worktrees are the right tool for the task.
2. Reuse the repository's preferred worktree location when one already exists.
3. Verify the worktree directory is ignored before creating a project-local worktree.
4. Create the worktree on a clearly named branch, then run the minimum project setup needed there.
5. Establish the baseline: report branch, path, and whether the initial checks pass.
6. If baseline verification fails, stop and decide whether to continue against a dirty baseline.

Do not create or clean up worktrees casually. Treat them as explicit execution boundaries.
