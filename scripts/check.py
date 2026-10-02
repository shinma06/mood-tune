#!/usr/bin/env python3
"""One check entry point for local hooks and CI; no application tests are implied."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]


def validate(root):
    names = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
    errors = []
    for name in sorted(set(filter(None, names))):
        path = root / name
        if path.is_symlink():
            if not path.exists() or not path.resolve().is_relative_to(root.resolve()):
                errors.append(name + ': broken or external symlink')
            continue
        if not path.is_file():
            errors.append(name + ': missing tracked file')
            continue
        if (name.startswith('.harness-local/') or path.name in {'auth.json', 'credentials.json'}
                or (path.name.startswith('.env') and path.name != '.env.example')):
            errors.append(name + ': private state must not be tracked')
        if path.suffix not in {'.md', '.mdc', '.py', '.sh', '.json', '.toml', '.yml', '.example'}:
            continue
        text = path.read_text()
        if re.search(r'(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----', text):
            errors.append(name + ': possible secret (value suppressed)')
        if re.search(r'/(?:Users|home)/[A-Za-z0-9_.-]+/', text):
            errors.append(name + ': user-specific absolute path')
        try:
            if path.suffix == '.json':
                json.loads(text)
            if path.suffix == '.toml':
                tomllib.loads(text)
        except ValueError:
            errors.append(name + ': invalid configuration syntax')
        if path.suffix in {'.md', '.mdc'}:
            for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
                target = link.split('#', 1)[0]
                if not target or '://' in target or target.startswith('mailto:'):
                    continue
                if not (path.parent / target).exists():
                    errors.append(name + ': broken local link: ' + target)
    return errors


def main():
    errors = validate(ROOT)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--cached', '--check'], cwd=ROOT, check=True)
    env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
                   cwd=ROOT, env=env, check=True)
    print('Harness checks passed. Application tests and real client/GUI acceptance are separate.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
