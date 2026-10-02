#!/usr/bin/env python3
"""Install repository hooks explicitly; preserve unrelated custom hooks."""
from pathlib import Path
import os
import subprocess


def bootstrap():
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    hook_dir = root / '.githooks'
    if not all((hook_dir / name).is_file() for name in ['pre-commit', 'pre-push']):
        raise ValueError('Run in a repository containing this harness.')
    scopes = [[], ['--local']]
    per_tree = subprocess.run(['git', 'config', '--bool', '--get', 'extensions.worktreeConfig'],
                              capture_output=True, text=True)
    if per_tree.returncode not in (0, 1):
        raise ValueError('Cannot inspect worktree configuration.')
    if per_tree.stdout.strip() == 'true':
        scopes.append(['--worktree'])
    for scope in scopes:
        result = subprocess.run(['git', 'config', *scope, '--get', 'core.hooksPath'],
                                capture_output=True, text=True)
        if result.returncode == 1:
            if not scope:
                default_hooks = Path(subprocess.check_output(
                    ['git', 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'], text=True).strip())
                if default_hooks.exists() and any(
                        p.is_file() and not p.name.endswith('.sample') and os.access(p, os.X_OK)
                        for p in default_hooks.iterdir()):
                    raise ValueError('Active default Git hooks found; integrate manually without disabling them.')
            continue
        if result.returncode != 0:
            raise ValueError('Cannot inspect existing hooks.')
        path = Path(result.stdout.strip())
        if not path.is_absolute():
            path = root / path
        if path.resolve() != hook_dir.resolve():
            raise ValueError('Custom hooks found; integrate manually without overwriting them.')
    for name in ['pre-commit', 'pre-push']:
        p = hook_dir / name
        p.chmod(p.stat().st_mode | 0o111)
    subprocess.run(['git', 'config', '--local', 'core.hooksPath', '.githooks'], check=True)
    if per_tree.stdout.strip() == 'true':
        subprocess.run(['git', 'config', '--worktree', 'core.hooksPath', '.githooks'], check=True)
    print('Hooks installed for this repository. Server protection is configured separately.')


if __name__ == '__main__':
    try:
        bootstrap()
    except (ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
