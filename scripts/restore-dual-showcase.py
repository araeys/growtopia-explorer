from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs' / 'assets'
CURRENT = ASSETS / 'growtopia-explorer-showcase.gif'
EDITED = ASSETS / 'growtopia-explorer-showcase-edited.gif'
README = ROOT / 'README.md'
OLD_COMMIT = 'ce97d69801e048e3ca1877816d83cf131e7b4e97'
OLD_PATH = 'docs/assets/growtopia-explorer-showcase.gif'

# Preserve the approved 30 FPS edited GIF under its own filename.
shutil.copyfile(CURRENT, EDITED)

# Restore the exact original browser showcase from Git history.
with CURRENT.open('wb') as handle:
    subprocess.run(
        ['git', 'show', f'{OLD_COMMIT}:{OLD_PATH}'],
        cwd=ROOT,
        stdout=handle,
        check=True,
    )

text = README.read_text(encoding='utf-8')
text = text.replace('![Growtopia Explorer Logo](public/logo.png)\n\n', '', 1)

start = '<!-- github-showcase:start -->'
end = '<!-- github-showcase:end -->'
if start not in text or end not in text:
    raise SystemExit('README showcase markers not found')

block = '''<!-- github-showcase:start -->
### Product walkthrough

<a href="https://growtopia-explorer.vercel.app">
  <img src="docs/assets/growtopia-explorer-showcase.gif" alt="Growtopia Explorer product walkthrough: Explore, Inspect, Style, Build, and Play" width="100%">
</a>

<sub><strong>Explore → Inspect → Style → Build → Play</strong> · original browser showcase · 1280×720</sub>

<br>

### Feature highlights

<a href="https://growtopia-explorer.vercel.app">
  <img src="docs/assets/growtopia-explorer-showcase-edited.gif" alt="Growtopia Explorer edited feature highlights with world building, physics, hazards, and moderator mode" width="100%">
</a>

<sub><strong>World building → Physics → Interaction → Hazards → Moderator mode</strong> · edited showcase · 30 FPS · 1280×720</sub>
<!-- github-showcase:end -->'''

before, remainder = text.split(start, 1)
_, after = remainder.split(end, 1)
README.write_text(before + block + after, encoding='utf-8')

for path in (CURRENT, EDITED):
    data = path.read_bytes()
    if len(data) < 1_000_000 or data[:4] != b'GIF8':
        raise SystemExit(f'Invalid GIF: {path.name}')

print(f'original={CURRENT.stat().st_size}')
print(f'edited={EDITED.stat().st_size}')
