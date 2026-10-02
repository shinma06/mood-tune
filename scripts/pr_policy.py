#!/usr/bin/env python3
"""Read live PR data and publish gates from trusted main; never execute PR code."""
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
from urllib.request import Request, urlopen

from git_guard import BRANCH

REPO = os.environ.get('GITHUB_REPOSITORY', 'shinma06/mood-tune')
TYPES = {'feature': '機能', 'bug': '修正', 'research': '調査', 'qa': '試験', 'maintenance': '運用', 'tracking': '追跡'}
AXES = {'type': set(TYPES), 'priority': {'P0', 'P1', 'P2'},
        'status': {'ready', 'in-progress', 'review', 'blocked', 'deferred', 'done'}}
MARKER = '<!-- moodtune-review -->'


def api(path, payload=None):
    endpoint = f'repos/{REPO}/{path}'
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        request = Request('https://api.github.com/' + endpoint,
                          data=json.dumps(payload).encode() if payload is not None else None,
                          headers={'Authorization': 'Bearer ' + token,
                                   'Accept': 'application/vnd.github+json',
                                   'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    command = ['gh', 'api', endpoint]
    if payload is not None:
        command += ['--method', 'POST', '--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def pages(path):
    result, page = [], 1
    while True:
        chunk = api(f'{path}{"&" if "?" in path else "?"}per_page=100&page={page}')
        if not isinstance(chunk, list):
            raise ValueError('Expected a GitHub list')
        result.extend(chunk)
        if len(chunk) < 100:
            return result
        page += 1


def field(body, name):
    values = re.findall(r'^' + re.escape(name) + r': (.+)$', body or '', re.M)
    if len(values) != 1 or not values[0].strip() or '<' in values[0]:
        raise ValueError('Provide exactly one concrete ' + name)
    return values[0].strip()


def validate_policy(pr, issue):
    branch = BRANCH.fullmatch(pr['head']['ref'])
    if not branch or pr['base']['ref'] != 'main':
        raise ValueError('Use an Issue-numbered branch targeting main')
    number = int(branch.group(2))
    body = pr.get('body') or ''
    if field(body, 'Issue') != f'#{number}' or issue['number'] != number:
        raise ValueError('Issue and branch number must match')
    if issue['state'] != 'open' or 'pull_request' in issue:
        raise ValueError('Link an open Issue, not a PR')
    selected = {}
    names = [label['name'] for label in issue['labels']]
    for axis, allowed in AXES.items():
        values = [name.split(':', 1)[1] for name in names if name.startswith(axis + ':')]
        if len(values) != 1 or values[0] not in allowed or values == ['done']:
            raise ValueError('Use exactly one valid open-Issue ' + axis + ' label')
        selected[axis] = values[0]
    prefix = '[' + TYPES[selected['type']] + '] '
    title = issue['title']
    if not title.startswith(prefix) or not title[len(prefix):].strip() or re.search(r'\bP[012]\b', title):
        raise ValueError('Issue title must match its type')
    if selected['type'] == 'qa' and not re.match(r'\[試験\] #[1-9][0-9]* \S', title):
        raise ValueError('QA titles must identify the original Issue')
    if field(body, 'Integration') != 'main':
        raise ValueError('Integration must be main')
    if field(body, 'Verification') != f'docs/verification/changes/issue-{number}.json':
        raise ValueError('Verification must identify this Issue acceptance JSON')
    if field(body, 'GUI') not in {'required', 'not-required'} or len(field(body, 'GUI reason')) < 8:
        raise ValueError('Give GUI required/not-required and a concrete reason')
    field(body, 'Writer')
    if re.search(r'(?i)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#|https://github.com/)', body):
        raise ValueError('Use Refs; close Issues after acceptance and Project readback')


def input_digest(pr, issue, base):
    data = {'head': pr['head']['sha'], 'base': base, 'target': pr['base']['ref'],
            'body': pr['body'], 'title': issue['title'], 'acceptance': issue['body'],
            'labels': sorted(label['name'] for label in issue['labels'])}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def validate_acceptance(data, pr, paths):
    gui = field(pr['body'], 'GUI') == 'required'
    issue = int(field(pr['body'], 'Issue')[1:])
    if (type(data.get('schema')) is not int or data['schema'] != 1 or data.get('issue') != issue
            or type(data.get('gui_required')) is not bool or data['gui_required'] != gui):
        raise ValueError('Acceptance schema, Issue or GUI declaration mismatch')
    if not isinstance(data.get('reason'), str) or len(data['reason'].strip()) < 8:
        raise ValueError('Acceptance needs a concrete reason')
    checks = data.get('cli_checks')
    if not isinstance(checks, list) or not checks or not all(isinstance(x, str) and x.strip() for x in checks):
        raise ValueError('Acceptance needs real CLI check commands')
    if not gui and any(p.startswith('src/') and (p.endswith(('.tsx', '.css')) or p.startswith('src/hooks/')) for p in paths):
        raise ValueError('UI and hook changes require GUI acceptance')
    cases = data.get('cases')
    if not isinstance(cases, list) or bool(cases) != gui:
        raise ValueError('Required GUI needs cases; not-required must have no GUI cases')
    ids = set()
    for case in cases:
        if not isinstance(case, dict) or not re.fullmatch(r'[A-Z][A-Z0-9-]+', case.get('id', '')) or case['id'] in ids:
            raise ValueError('Invalid or duplicate case ID')
        ids.add(case['id'])
        for key in ('preconditions', 'expected'):
            if not isinstance(case.get(key), str) or not case[key].strip():
                raise ValueError('Missing case ' + key)
        if not isinstance(case.get('steps'), list) or not case['steps'] or not all(isinstance(x, str) and x.strip() for x in case['steps']):
            raise ValueError('Cases need reproducible steps')
    return ids


def review_record(comments):
    eligible = [c for c in comments if MARKER in (c.get('body') or '')
                and c.get('author_association') in {'OWNER', 'MEMBER', 'COLLABORATOR'}]
    if not eligible:
        raise ValueError('Independent review record is pending')
    latest = max(eligible, key=lambda c: c['id'])
    match = re.search(r'```json\s*\n(.*?)\n```', latest['body'], re.S)
    if not match:
        raise ValueError('Latest review record must contain a JSON block')
    record = json.loads(match.group(1))
    if not isinstance(record, dict):
        raise ValueError('Review record must be an object')
    return record


def validate_review(record, pr, issue, base):
    if (record.get('head') != pr['head']['sha'] or record.get('base') != base
            or record.get('input_digest') != input_digest(pr, issue, base)):
        raise ValueError('Review is stale: HEAD/base/metadata/acceptance changed')
    reviewer = record.get('reviewer_session')
    if not isinstance(reviewer, str) or not reviewer.strip() or reviewer == field(pr['body'], 'Writer'):
        raise ValueError('A separate reviewer session is required')
    if record.get('verdict') != 'approved' or record.get('unresolved_findings') != []:
        raise ValueError('Independent review has unresolved findings or is not approved')
    if not isinstance(record.get('evidence'), str) or not record['evidence'].strip():
        raise ValueError('Record the actual review evidence')


def validate_observations(record, ids, head):
    results = record.get('cases')
    if not isinstance(results, list) or {r.get('id') for r in results if isinstance(r, dict)} != ids or len(results) != len(ids):
        raise ValueError('Every required case needs exactly one observation')
    for result in results:
        if result.get('status') != 'pass' or result.get('head') != head:
            raise ValueError('All required GUI cases must pass at the current HEAD')
        for key in ('observer', 'build', 'evidence'):
            if not isinstance(result.get(key), str) or not result[key].strip():
                raise ValueError('GUI observation needs ' + key)


def run(number, publish=False):
    pr = api(f'pulls/{number}')
    if pr['state'] != 'open':
        print(f'PR #{number} is closed; no new acceptance claimed.')
        return True
    base = api('git/ref/heads/main')['object']['sha']
    head = pr['head']['sha']
    if publish:
        # Invalidate old success before parsing changed metadata or fetching evidence.
        for context in ('PR policy', 'Agent review', 'Acceptance gate'):
            api(f'statuses/{head}', {'state': 'pending', 'context': context,
                'description': 'Checking current inputs and evidence', 'target_url': pr['html_url']})
    results = {}
    issue_number = field(pr.get('body'), 'Issue')
    if not re.fullmatch(r'#[1-9][0-9]*', issue_number):
        raise ValueError('Issue must be a positive repository Issue number')
    issue = api('issues/' + issue_number[1:])
    try:
        validate_policy(pr, issue)
        results['PR policy'] = ('success', 'Issue, branch, labels and PR metadata match')
    except (ValueError, KeyError, TypeError) as error:
        results['PR policy'] = ('failure', str(error))
    try:
        validate_policy(pr, issue)
        record = review_record(pages(f'issues/{number}/comments'))
        validate_review(record, pr, issue, base)
        results['Agent review'] = ('success', 'Separate-session review matches current inputs')
    except (ValueError, KeyError, TypeError) as error:
        results['Agent review'] = ('failure', str(error))
        record = None
    try:
        validate_policy(pr, issue)
        content = api(f"contents/{field(pr['body'], 'Verification')}?ref={head}")
        data = json.loads(base64.b64decode(content['content']))
        paths = [p for f in pages(f'pulls/{number}/files') for p in (f['filename'], f.get('previous_filename', f['filename']))]
        ids = validate_acceptance(data, pr, paths)
        if ids:
            if record is None:
                raise ValueError('GUI evidence is pending a current independent review')
            validate_observations(record, ids, head)
        results['Acceptance gate'] = ('success', 'Acceptance cases and current GUI evidence match')
    except (ValueError, KeyError, TypeError) as error:
        results['Acceptance gate'] = ('failure', str(error))
    latest = api(f'pulls/{number}')
    if latest['state'] != 'open':
        return True
    if (latest['head']['sha'] != head or api('git/ref/heads/main')['object']['sha'] != base
            or input_digest(latest, api(f"issues/{issue['number']}"), base) != input_digest(pr, issue, base)):
        raise ValueError('Live inputs changed during checking; rerun')
    print(json.dumps({'pr': number, 'head': head, 'base': base,
                      'input_digest': input_digest(pr, issue, base), 'checks': results}, ensure_ascii=False, indent=2))
    if publish:
        for context, (state, description) in results.items():
            api(f'statuses/{head}', {'state': state, 'context': context,
                'description': description[:140], 'target_url': pr['html_url']})
    return all(state == 'success' for state, _ in results.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pr', type=int)
    parser.add_argument('--publish', action='store_true', help='Authorized coordinator only; writes commit statuses')
    args = parser.parse_args()
    if args.pr:
        numbers = [args.pr]
    else:
        event = json.loads(open(os.environ['GITHUB_EVENT_PATH']).read())
        if 'pull_request' in event:
            numbers = [event['pull_request']['number']]
        elif event.get('issue', {}).get('pull_request'):
            numbers = [event['issue']['number']]
        else:
            issues = event.get('issue')
            numbers = [p['number'] for p in pages('pulls?state=open&base=main')
                       if not issues or re.search(r'^Issue: #' + str(issues['number']) + r'\s*$', p.get('body') or '', re.M)]
    success = True
    for number in numbers:
        success = run(number, args.publish) and success
    return 0 if success else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit('Policy check failed: ' + str(error))
