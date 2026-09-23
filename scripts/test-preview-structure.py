"""Check the Ronu release candidate without changing repository or website data.

Usage: python scripts/test-preview-structure.py --site-root docs --screenshots /tmp/ronu
Requires Playwright and Chromium. Uses localhost with published CSP when permitted;
otherwise uses an explicitly reported in-memory fixture with embedded site assets.
"""
import argparse, base64, functools, http.server, json, mimetypes, re, shutil, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--site-root', type=Path, required=True)
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
root = args.site_root.resolve()
preview = root / 'preview'
source_html = (preview / 'index.html').read_text(encoding='utf-8')
assert 'Content-Security-Policy' in source_html
assert 'noindex' in source_html
assert 'about-dialog' not in source_html and 'preview-notice' not in source_html
assert '<link href="/privacy/" rel="privacy-policy"/>' in source_html
for name in re.findall(r'(?:src|href)="([^\"]+\.(?:css|js)(?:\?[^\"]*)?)"', source_html):
    assert (preview / name.split('?')[0]).is_file(), name

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
local_url = f'http://127.0.0.1:{server.server_port}/preview/'

# Only the fallback fixture relaxes CSP. Original article bodies are used as fixtures.
fixture = re.sub(r'<meta\b(?=[^>]*http-equiv="Content-Security-Policy")[^>]*>', '', source_html, flags=re.I)
fixture = re.sub(r'<link\b[^>]*href="([^\"]+)"[^>]*rel="stylesheet"[^>]*>',
                 lambda m:'<style>'+(preview/m[1].split('?')[0]).read_text(encoding='utf-8')+'</style>',fixture)
fixture = re.sub(r'<script\b[^>]*src="([^\"]+)"[^>]*></script>',
                 lambda m:'<script>'+(preview/m[1].split('?')[0]).read_text(encoding='utf-8')+'</script>',fixture)
for asset in (root/'assets').iterdir():
    if asset.is_file():
        mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
        fixture = fixture.replace('/assets/'+asset.name,'data:'+mime+';base64,'+base64.b64encode(asset.read_bytes()).decode())
source_files = {'docs/'+p.relative_to(root).as_posix():p.read_text(encoding='utf-8')
                for p in root.rglob('*.html') if 'preview' not in p.relative_to(root).parts}
fetch_fixture = '<script>const fixtureSources='+json.dumps(source_files).replace('<',r'\u003c')+''';window.fetch=async function(url){
 const key=Object.keys(fixtureSources).find(k=>String(url).endsWith(k));
 return {ok:!!key,status:key?200:404,text:async()=>key?fixtureSources[key]:''};};</script>'''
fixture=fixture.replace('<script',fetch_fixture+'<script',1)
expected={
 'triathlon':[
  'I set a goal, make a plan and start training. A lot of it is repetition, with adjustments along the way.',
  'Sometimes I go further than I expected. Other times, I can’t finish something I’ve done before. And I start wondering why. What changed? Was it the training, the recovery, something else?',
  'I enjoy the sport because it allows me to figure out what’s happening in my body and what I could do differently. There’s a lot I still don’t understand.'
 ],
 'science':[
  'Some everyday things make me curious. Why does traffic stop when nothing is blocking the road? Why is a roll of the dice so hard to predict?',
  'I like looking for the rules and patterns behind what I see.'
 ],
 'markets':[
  'Will rates fall? What will the dollar be worth tomorrow? What drives prices? And what happens if the forecast is wrong?',
  'I’m always trying to make the best decision the data can support. But in the end, the market doesn’t care.'
 ],'maker':[]
}
checks=[]; errors=[]; mode='localhost, published CSP; article responses locally intercepted'
def check(name, condition):
    assert condition, name
    checks.append(name)
def route(page, section):
    page.evaluate('(s)=>location.hash=s', '#explore' if section=='all' else '#section/'+section)
    page.wait_for_timeout(80)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    probe=browser.new_page()
    try:
        probe.goto(local_url,wait_until='load',timeout=8000)
        probe.wait_for_selector('#section-carousel',timeout=3000)
        local_available=True
    except Exception as error:
        local_available=False
        mode='in-memory fixture; embedded assets; no live delivery or CSP verification'
        print('Local navigation unavailable:',str(error).splitlines()[0])
    probe.close()
    def fresh(width=390):
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        page.on('pageerror',lambda e:errors.append(str(e)))
        if local_available:
            def intercept(r):
                path=next((k for k in source_files if r.request.url.endswith(k)),None)
                if path:r.fulfill(status=200,content_type='text/html',body=source_files[path],headers={'Access-Control-Allow-Origin':'*'})
                else:r.abort()
            page.route('https://raw.githubusercontent.com/**',intercept)
            page.route('https://raw.githack.com/**',intercept)
            page.goto(local_url,wait_until='load')
        else:page.set_content(fixture,wait_until='load')
        page.wait_for_selector('#section-carousel')
        return page
    for width in [320,390,768,1024,1440]:
        page=fresh(width)
        for section in ['all','triathlon','science','markets','maker']:
            route(page,section)
            prefix=f'{width}/{section}'
            check(prefix+' one h1',page.locator('h1:visible').count()==1)
            check(prefix+' no overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            check(prefix+' orange unchanged',page.evaluate('getComputedStyle(document.body).getPropertyValue("--accent").trim()')=='#ff7a1a')
            check(prefix+' no development labels',not re.search(r'design preview|layout sample|not published|working draft|unlinked|try an accent|L10 /',page.locator('body').inner_text(),re.I))
            check(prefix+' no test UI',page.locator('.preview-notice,.prototype-indicator,.accent-picker,#about-dialog,.index-number').count()==0)
            check(prefix+' footer Since 2022',page.locator('.footer-inner > p').inner_text()=='Since 2022')
            check(prefix+' no footer name or Privacy link',not re.search(r'Rafael|Privacy',page.locator('.site-footer').inner_text()) and page.locator('.site-footer a[href="/privacy/"]').count()==0)
            if section!='all':check(prefix+' approved paragraphs',page.locator('#page-intro .index-intro > p').all_text_contents()==expected[section])
            if section in ['triathlon','science']:
                check(prefix+' one article',page.locator('.article-tile').count()==1)
                check(prefix+' Articles label',page.locator('#collection-title').inner_text()=='Articles')
            elif section=='markets':
                check(prefix+' no fabricated articles',page.locator('.article-tile').count()==0)
                check(prefix+' empty collection hidden',page.locator('#page-collection').is_hidden())
            elif section=='maker':
                page.wait_for_function('[...document.querySelectorAll("#maker-gallery img")].every(i=>i.complete&&i.naturalWidth>0)')
                check(prefix+' all real images',page.locator('#maker-gallery img').count()==3)
                check(prefix+' no extra gallery text',page.locator('.gallery-description,.gallery-caption,#page-intro .index-intro').count()==0)
                check(prefix+' meaningful image alternatives',page.evaluate('[...document.querySelectorAll("#maker-gallery img")].every(i=>i.alt.length>10)'))
            else:
                check(prefix+' four sections only',page.locator('#section-carousel [data-slide]').count()==4 and page.locator('.article-tile').count()==0)
                check(prefix+' concise teaser',page.locator('#section-carousel [data-slide]').first.locator('.index-intro > p').all_text_contents()==expected['triathlon'][:1])
        page.close()
    page=fresh()
    page.locator('#section-carousel [data-step="1"]').click()
    check('section next',page.locator('#section-carousel .is-active h3').inner_text()=='Science.')
    page.locator('#section-carousel [aria-selected="true"]').focus();page.keyboard.press('End')
    check('keyboard End',page.locator('#section-carousel .is-active h3').inner_text()=='Maker.')
    page.locator('#section-carousel .is-active a').click();page.wait_for_timeout(80)
    check('Maker opens',page.locator('#page-title').inner_text()=='Maker.')
    page.locator('#maker-gallery [data-step="1"]').click()
    check('image next',page.locator('#maker-gallery .is-active img').get_attribute('alt')=='A reflective night-time view toward the Manhattan skyline.')
    page.locator('#maker-gallery [data-dot="2"]').click()
    check('image dot',page.locator('#maker-gallery .is-active img').get_attribute('alt')=='A runner beside the waterfront at night.')
    check('inert images',page.locator('#maker-gallery [inert]').count()==2)
    page.evaluate('window.oldCarousel=pageCarousel')
    route(page,'triathlon')
    check('carousel disposed',page.evaluate('oldCarousel.destroyed&&oldCarousel.events.signal.aborted'))
    for section,title in [('triathlon','Endurance'),('science','The Complexity of Prediction')]:
        route(page,section);page.locator('.article-tile').click()
        page.wait_for_function('document.querySelector("#source-content")?.shadowRoot?.textContent.length>1000')
        check(title+' loaded',page.locator('#reader-title').inner_text()==title)
        check(title+' footer Since 2022',page.locator('.footer-inner > p').inner_text()=='Since 2022')
        check(title+' no footer Privacy link',page.locator('.site-footer a[href="/privacy/"]').count()==0)
        check(title+' no reader development labels',not re.search(r'site preview|new reading layout|source snapshot|restyled|not been re-reviewed',page.locator('#reader-page').inner_text(),re.I))
        page.locator('.reader-top a').click();page.wait_for_timeout(80)
        check(title+' return',page.locator('#page-title').inner_text()==section.capitalize()+'.')
    page.locator('#search-open').click();page.locator('#global-search').fill('traffic')
    check('final Science copy searchable',page.locator('#search-results a[href="#section/science"]').count()==1)
    check('existing experiments searchable',page.locator('#search-results a[href="#topic/traffic"]').count()==1)
    page.keyboard.press('Escape');check('Escape search',not page.locator('#search-dialog').evaluate('(d)=>d.open'))
    route(page,'all')
    page.evaluate('SITE.carousel.intervalMs=100')
    page.locator('#section-carousel [data-toggle]').click();page.mouse.move(0,0);page.wait_for_timeout(140)
    check('Play works',page.locator('#section-carousel').get_attribute('data-playing')=='true')
    page.locator('#section-carousel [data-dot="1"]').click();page.wait_for_timeout(220)
    check('manual selection pauses',page.locator('#section-carousel [aria-selected="true"]').get_attribute('data-dot')=='1' and page.locator('#section-carousel').get_attribute('data-playing')=='false')
    page.close()
    check('no JavaScript errors',not errors)
    if args.screenshots:
        args.screenshots.mkdir(parents=True,exist_ok=True)
        for width,label in [(390,'mobile'),(1440,'desktop')]:
            page=fresh(width)
            for section in ['all','triathlon','science','markets','maker']:
                route(page,section)
                if section=='maker':page.wait_for_function('[...document.querySelectorAll("#maker-gallery img")].every(i=>i.complete&&i.naturalWidth>0)')
                page.screenshot(path=str(args.screenshots/f'ronu-ready-{section}-{label}.png'),full_page=True)
            page.close()
    browser.close()
server.shutdown()
print(json.dumps({'passed':len(checks),'failed':0,'mode':mode},indent=2))
