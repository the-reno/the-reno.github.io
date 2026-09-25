"""Validate the published static site. Does not write files or publish changes."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
site = root / 'docs'
errors = []

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.metadata = {}
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.metadata[(attrs.get('name') or attrs.get('http-equiv') or '').lower()] = attrs.get('content','')
        if tag == 'link': self.links.append(attrs)
        for attr in ('src', 'href'):
            if attr in attrs: self.references.append(attrs[attr])

for file in site.rglob('*.html'):
    parsed = Document()
    parsed.feed(file.read_text(encoding='utf-8'))
    if 'content-security-policy' not in parsed.metadata: errors.append(f'{file.relative_to(root)}: missing CSP')
    if 'viewport' not in parsed.metadata: errors.append(f'{file.relative_to(root)}: missing viewport')
    if 'author' in parsed.metadata: errors.append(f'{file.relative_to(root)}: author metadata is not used by this site')
    for ref in parsed.references:
        part = urlsplit(ref)
        if part.scheme or part.netloc or not part.path: continue
        path = site / unquote(part.path).lstrip('/') if part.path.startswith('/') else file.parent / unquote(part.path)
        if path.is_dir(): path = path / 'index.html'
        if not path.exists(): errors.append(f'{file.relative_to(root)}: unresolved local file {part.path}')

for file in site.glob('*.js'):
    result = subprocess.run(['node','--check',str(file)],capture_output=True,text=True)
    if result.returncode: errors.append(result.stderr)

catalogue = subprocess.run(['node','-e', '''
const fs = require('fs'), vm = require('vm');
const dir = process.argv[1], context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(dir+'/page-content.js','utf8'),context);
vm.runInContext(fs.readFileSync(dir+'/content.js','utf8'),context);
process.stdout.write(vm.runInContext('JSON.stringify({site:SITE,pages:MAIN_PAGES,topics:TOPICS,gallery:MAKER_GALLERY})',context));
''', str(site)],capture_output=True,text=True)
if catalogue.returncode:
    errors.append(catalogue.stderr)
else:
    data = json.loads(catalogue.stdout)
    ids = {t['id'] for t in data['topics']}
    if len(ids) != len(data['topics']): errors.append('Duplicate article IDs')
    for topic in data['topics']:
        path = topic.get('articleFile','')
        if not re.fullmatch(r'articles/[a-z0-9-]+\.json',path):
            errors.append('Invalid article source path'); continue
        file = site/path
        if not file.is_file(): errors.append(f'Missing article: {path}'); continue
        article = json.loads(file.read_text(encoding='utf-8'))
        if article.get('id') != topic['id']: errors.append(f'Article ID mismatch: {path}')
        if not article.get('sections'): errors.append(f'Empty article: {path}')
    for page in data['pages'].values():
        for article_id in page.get('articleIds',[]):
            if article_id not in ids: errors.append(f'Unresolved article selection: {article_id}')
    for image in data['gallery']['images']:
        if not (site/image['src'].lstrip('/')).is_file(): errors.append('Missing gallery asset')
        if not image.get('alt','').strip(): errors.append('Missing image description')


# Visitor-record integration checks.
origin = 'https://ronu-records.rafatreno.workers.dev'
required = ['feedback.js','feedback.css','visits.js','records-config.js']
for name in required:
    if not (site/name).is_file(): errors.append(f'Missing visitor-record integration: {name}')
index_text = (site/'index.html').read_text(encoding='utf-8')
if origin not in index_text: errors.append('Worker origin missing from website CSP')
for name in ('feedback.js','visits.js','records-config.js'):
    if name not in index_text: errors.append(f'Website does not load {name}')
records_config = (site/'records-config.js').read_text(encoding='utf-8') if (site/'records-config.js').is_file() else ''
if origin not in records_config or 'enabled: true' not in records_config:
    errors.append('Visitor records are not configured for the verified service')
privacy_text = (site/'privacy'/'index.html').read_text(encoding='utf-8')
for phrase in ('connection IP address','first-level region','manually deleted','Cloudflare','Feedback'):
    if phrase not in privacy_text: errors.append(f'Privacy notice missing disclosure: {phrase}')
visits_text = (site/'visits.js').read_text(encoding='utf-8')
if 'Privacy choices' in visits_text or 'localStorage' in visits_text or 'consent:true' in visits_text:
    errors.append('Visitor tracker must not show or require a privacy choice')
for phrase in ('active_seconds','max_scroll','session_id','visibilitychange'):
    if phrase not in visits_text: errors.append(f'Visit engagement tracker missing: {phrase}')
for file in site.rglob('*'):
    if file.is_file() and file.suffix.lower() in {'.html','.js','.css','.json','.txt','.xml'}:
        text_value = file.read_text(encoding='utf-8', errors='ignore')
        if 'ronu-private.rafatreno.workers.dev' in text_value:
            errors.append(f'{file.relative_to(root)}: obsolete private Worker reference')
        if 'ADMIN_TOKEN' in text_value:
            errors.append(f'{file.relative_to(root)}: administrator credential name must not be in public site files')

if (site/'CNAME').read_text().strip() != 'ronu.one': errors.append('Custom domain mismatch')
if 'noindex' in (site/'index.html').read_text(): errors.append('Main page must not be noindex')
if errors:
    raise SystemExit('Site validation failed:\n- ' + '\n- '.join(errors))
print('Site validation passed: local references, syntax, catalogue, content and gallery assets.')
