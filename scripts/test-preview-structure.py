"""Local Chromium fixture smoke tests for the unlinked Ronu preview.
Run: python test_preview.py --site-root /path/to/repo/docs
Requires playwright and Chromium. The fixture embeds local assets and omits CSP;
it does not claim to test live delivery. No network, repository or publishing writes.
"""
import argparse, base64, json, mimetypes, re, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--site-root', type=Path, required=True)
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
root = args.site_root.resolve()
preview = root / 'preview'
html = (preview / 'index.html').read_text()
# Remove only the fixture's CSP so embedded scripts/styles are executable.
html = re.sub(r'<meta\b(?=[^>]*http-equiv="Content-Security-Policy")[^>]*>', '', html, flags=re.I)
def style(match):
    path = preview / match[1].split('?')[0]
    assert path.is_file(), path
    return '<style>' + path.read_text() + '</style>'
html = re.sub(r'<link href="([^\"]+)" rel="stylesheet"\s*/>', style, html)
def script(match):
    path = preview / match[1].split('?')[0]
    assert path.is_file(), path
    return '<script>' + path.read_text() + '</script>'
html = re.sub(r'<script\b[^>]*src="([^\"]+)"[^>]*></script>', script, html)
for asset in (root / 'assets').iterdir():
    if asset.is_file():
        mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
        data = 'data:' + mime + ';base64,' + base64.b64encode(asset.read_bytes()).decode()
        html = html.replace('/assets/' + asset.name, data)
source_files = {('docs/' + p.relative_to(root).as_posix()): p.read_text() for p in root.rglob('*.html') if 'preview' not in p.relative_to(root).parts}
# Supply existing article bodies, not invented snippets, to the unchanged reader.
fixture_fetch = '<script>const fixtureSources=' + json.dumps(source_files).replace('<', r'\u003c') + ';window.fetch=async function(url){const u=String(url); const key=Object.keys(fixtureSources).find(k=>u.endsWith(k));return {ok:!!key,status:key?200:404,text:async()=>key?fixtureSources[key]:""};};</script>'
html = html.replace('<script', fixture_fetch + '<script', 1)
checks = []
def check(label, condition):
    assert condition, label
    checks.append(label)
def route(page, target):
    page.evaluate('(hash)=>{location.hash=hash}', target)
    page.wait_for_timeout(70)

def fresh(browser, width=390):
    page = browser.new_page(viewport={'width':width,'height':900}, reduced_motion='reduce')
    page.set_content(html, wait_until='load')
    return page

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width in [320,390,768,1024,1440]:
        page = fresh(browser,width)
        errors=[]; page.on('pageerror', lambda error: errors.append(str(error)))
        for section in ['all','triathlon','science','markets','maker']:
            route(page, '#explore' if section == 'all' else '#section/'+section)
            check(f'{width}/{section}: shared header',page.locator('#page-intro.index-hero > .index-copy').count() == 1)
            check(f'{width}/{section}: shared collection',page.locator('#page-collection.page-collection').count()==1)
            check(f'{width}/{section}: one visible h1',page.locator('h1:visible').count()==1)
            check(f'{width}/{section}: no index numbers',page.locator('.index-number').count()==0)
            check(f'{width}/{section}: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth') )
            check(f'{width}/{section}: unchanged orange',page.evaluate('getComputedStyle(document.body).getPropertyValue("--accent").trim()')=='#ff7a1a')
            if section in ['triathlon','science','markets']:
                check(f'{width}/{section}: one card',page.locator('.article-tile').count()==1)
                check(f'{width}/{section}: Articles label',page.locator('#collection-title').inner_text()=='Articles')
            if section=='all':
                check(f'{width}: section-first Explore',page.locator('.article-tile').count()==0 and page.locator('#section-carousel [data-slide]').count()==4)
                check(f'{width}: approved Explore copy',page.locator('#page-intro .index-statement').inner_text()=='Stay curious.')
            if section=='maker':
                check(f'{width}: three existing images',page.locator('#maker-gallery img').count()==3)
                check(f'{width}: images decode',page.evaluate('[...document.querySelectorAll("#maker-gallery img")].every(i=>i.complete && i.naturalWidth>0)'))
                check(f'{width}: blank intro preserved',page.locator('#page-intro .index-intro').count()==0)
            if section=='markets': check(f'{width}: honest sample',page.locator('.article-tile.is-sample').inner_text().endswith('Layout sample · Not published'))
        check(f'{width}: no script errors',not errors)
        page.close()
    page=fresh(browser)
    page.locator('#section-carousel [data-step="1"]').click()
    check('next section',page.locator('#section-carousel .is-active h3').inner_text()=='Science.')
    page.locator('#section-carousel [role="tab"][aria-selected="true"]').focus()
    page.keyboard.press('End')
    check('keyboard End',page.locator('#section-carousel .is-active h3').inner_text()=='Maker.')
    page.locator('#section-carousel .is-active a').click()
    page.wait_for_timeout(80)
    check('carousel opens Maker',page.locator('#page-title').inner_text()=='Maker.')
    page.locator('#maker-gallery [data-step="1"]').click()
    check('next image',page.locator('#maker-gallery .is-active .gallery-caption span').first.inner_text()=='Manhattan reflections')
    page.locator('#maker-gallery [data-dot="2"]').click()
    check('select image',page.locator('#maker-gallery .is-active .gallery-caption span').first.inner_text()=='Night runner')
    check('inactive slides inert',page.locator('#maker-gallery [data-slide][inert]').count()==2)
    # The old carousel is disposed, not just visually hidden, when changing routes.
    page.evaluate('window.previousCarousel=pageCarousel')
    route(page,'#section/triathlon')
    check('carousel lifecycle disposed',page.evaluate('previousCarousel.destroyed && previousCarousel.events.signal.aborted'))
    page.locator('.article-tile').click();page.wait_for_timeout(100)
    check('existing reader works',page.locator('#reader-title').inner_text()=='Endurance')
    check('actual article imported',page.locator('#source-content').evaluate('(h)=>h.shadowRoot && h.shadowRoot.textContent.length > 1000'))
    page.locator('.reader-top a').click();page.wait_for_timeout(70)
    check('return to section',page.locator('#page-title').inner_text()=='Triathlon.')
    page.locator('#search-open').click();page.locator('#global-search').fill('chaos')
    check('all article routes remain searchable',page.locator('#search-results a[href="#topic/chaos-motion"]').count()==1)
    page.keyboard.press('Escape');check('dialog Escape',not page.locator('#search-dialog').evaluate('(d)=>d.open'))
    route(page,'#explore')
    page.evaluate('SITE.carousel.intervalMs=90; pageCarousel.motion')
    page.locator('#section-carousel [data-toggle]').click()
    page.mouse.move(0,0)
    page.wait_for_timeout(125)
    check('automatic rotation after Play',page.locator('#section-carousel').get_attribute('data-playing')=='true')
    page.locator('#section-carousel [data-dot="1"]').click()
    selected=page.locator('#section-carousel [aria-selected="true"]').get_attribute('data-dot')
    page.wait_for_timeout(200)
    check('manual selection stops rotation',selected==page.locator('#section-carousel [aria-selected="true"]').get_attribute('data-dot') and page.locator('#section-carousel').get_attribute('data-playing')=='false')
    page.close()
    page=fresh(browser)
    page.evaluate("MAIN_PAGES.science.start='Shared '; MAIN_PAGES.science.end='copy test.'; MAIN_PAGES.science.intro='One source.'")
    route(page,'#section/science')
    check('single-source section copy',page.locator('#page-intro .index-statement').inner_text().replace('\n',' ')=='Shared copy test.')
    route(page,'#explore');page.locator('#section-carousel [data-dot="1"]').click()
    check('single-source Explore copy',page.locator('#section-carousel .is-active .index-statement').inner_text().replace('\n',' ')=='Shared copy test.')
    page.locator('#search-open').click();page.locator('#global-search').fill('copy test')
    check('single-source search copy',page.locator('#search-results a[href="#section/science"]').count()==1)
    page.close()
    if args.screenshots:
        args.screenshots.mkdir(parents=True,exist_ok=True)
        for width,label in [(390,'mobile'),(1440,'desktop')]:
            page=fresh(browser,width)
            page.screenshot(path=str(args.screenshots/f'ronu-explore-structure-{label}.png'),full_page=True)
            route(page,'#section/triathlon')
            page.screenshot(path=str(args.screenshots/f'ronu-section-structure-{label}.png'),full_page=True)
            page.close()
    browser.close()
print(json.dumps({'passed':len(checks),'failed':0,'mode':'in-memory Chromium fixture; no live-delivery/CSP certification'},indent=2))
