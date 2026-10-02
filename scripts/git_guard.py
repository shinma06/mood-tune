#!/usr/bin/env python3
"""Local accident prevention, not a substitute for server branch protection."""
import re
import subprocess
import sys

BRANCH = re.compile(r'(agent|codex|claude|cursor)/([1-9][0-9]*)-[a-z0-9][a-z0-9-]*')


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def check_branch(branch):
    if not BRANCH.fullmatch(branch):
        raise ValueError('Use an Issue branch in its own worktree: agent|codex|claude|cursor/<issue>-<slug>. main/detached commits are forbidden.')


def check_push(lines, branch, head, dirty):
    changes = False
    for line in lines:
        local_ref, local_sha, remote_ref, remote_sha = line.split()
        if remote_ref in ('refs/heads/main', 'refs/heads/master', 'refs/heads/develop'):
            raise ValueError('Direct push/deletion of main/master/develop is forbidden. Use a GitHub PR.')
        if set(local_sha) == {'0'}:
            # Own task branch cleanup only; tags/other namespaces are not this workflow.
            check_branch(branch)
            if remote_ref != 'refs/heads/' + branch:
                raise ValueError('Delete only your current Issue branch, never another task branch.')
            continue
        check_branch(branch)
        if remote_ref != 'refs/heads/' + branch or local_sha != head:
            raise ValueError('Push only the current tested HEAD to its same-name Issue branch.')
        changes = True
    if changes and dirty:
        raise ValueError('Commit your assigned changes before push; dirty files would invalidate the test/HEAD match.')
    return changes


def main():
    try:
        branch = git('branch', '--show-current')
        if sys.argv[1] == 'commit':
            check_branch(branch)
        else:
            lines = sys.stdin.read().splitlines()
            changes = check_push(lines, branch, git('rev-parse', 'HEAD'),
                                 bool(git('status', '--porcelain')))
            for line in lines:
                _, local_sha, _, remote_sha = line.split()
                if set(local_sha) != {'0'} and set(remote_sha) != {'0'}:
                    if subprocess.run(['git', 'merge-base', '--is-ancestor', remote_sha, local_sha],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
                        raise ValueError('Non-fast-forward or unknown remote history. Fetch and reconcile; never force push.')
            # Hook uses output to skip tests for branch-deletion-only pushes.
            print('test' if changes else 'skip')
        return 0
    except (ValueError, subprocess.CalledProcessError) as error:
        print('[git guard] ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
