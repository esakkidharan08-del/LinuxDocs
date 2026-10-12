import json
import sys
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parent / 'data' / 'commands.json'
REQUIRED_FIELDS = {'slug', 'name', 'category', 'section', 'summary', 'syntax', 'description', 'options', 'examples', 'useCases', 'related', 'tags'}


def validate(data):
    errors = []
    commands = data.get('commands', [])
    categories = {item['id'] for item in data.get('categories', [])}
    domains = {item['id'] for item in data.get('domains', [])}
    slugs = set()
    if not commands:
        errors.append('No commands found')
    review = set(data.get('needsHumanReview', []))
    for command in commands:
        missing = REQUIRED_FIELDS - command.keys()
        if missing:
            errors.append(f"{command.get('slug', '<unknown>')} missing fields: {', '.join(sorted(missing))}")
        slug = command.get('slug')
        if slug in slugs:
            errors.append(f'Duplicate slug: {slug}')
        slugs.add(slug)
        expected = categories if command.get('section') == 'linux' else domains
        if command.get('category') not in expected:
            errors.append(f"{slug} has invalid {command.get('section')} category: {command.get('category')}")
        if len(command.get('examples', [])) < 3 and slug not in review:
            errors.append(f'{slug} needs at least 3 examples')
        if (not command.get('options') or not command.get('useCases') or not command.get('tags')) and slug not in review:
            errors.append(f'{slug} has incomplete options, use cases, or tags')
        for related in command.get('related', []):
            if related not in slugs and not any(item.get('slug') == related for item in commands):
                errors.append(f'{slug} references missing related slug: {related}')
    return errors


def main():
    with DATA_PATH.open(encoding='utf-8') as data_file:
        data = json.load(data_file)
    errors = validate(data)
    print(f"commands={len(data['commands'])}")
    print(f"linux={sum(item['section'] == 'linux' for item in data['commands'])}")
    print(f"ctf={sum(item['section'] == 'ctf' for item in data['commands'])}")
    print(f"examples={sum(len(item['examples']) for item in data['commands'])}")
    print(f"needs-human-review={','.join(data.get('needsHumanReview', [])) or 'none'}")
    if errors:
        print('\n'.join(errors))
        return 1
    print('link-check: PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
