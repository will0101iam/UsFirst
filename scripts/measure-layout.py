#!/usr/bin/env python3
"""Local layout measurement for the synthetic fixture. No production calls, no account data."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

OUT = pathlib.Path('/tmp/usfirst-layout'); OUT.mkdir(exist_ok=True)
GEOM = """() => {
  const box = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect();
    return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; };
  return {
    vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
    standalone: matchMedia('(display-mode: standalone)').matches,
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)'),
    doc: { h: document.documentElement.scrollHeight, cls: document.documentElement.className, overflow: getComputedStyle(document.documentElement).overflow },
    page: box('.oa-page'), scroll: box('.home-scroll'), topbar: box('.topbar'), workspace: box('.workspace'),
    paper: box('.focus-request-paper'), actions: box('.focus-request-actions'),
    dock: box('.nav-dock'), nav: box('.bottom-nav'),
    shell: box('#boot-shell')
  };
}"""

def run(mode):
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        ctx = browser.new_context(viewport={'width':393,'height':852}, device_scale_factor=3, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send('Emulation.setEmulatedMedia', {'features':[{'name':'display-mode','value':mode}]})
        page.goto('http://127.0.0.1:32923/', wait_until='domcontentloaded')
        page.wait_for_selector('.focus-request', timeout=15000)
        page.wait_for_timeout(250)
        geom = page.evaluate(GEOM)
        page.screenshot(path=str(OUT / f'home-{mode}.png'), full_page=False)
        # sheet geometry: open the detail sheet
        page.click('.focus-request-more')
        page.wait_for_selector('.app-sheet', timeout=8000)
        page.wait_for_timeout(350)
        sheet = page.evaluate("""() => { const b = s => { const el=document.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}; };
          return { sheet:b('.app-sheet'), heading:b('.sheet-heading'), scroll:b('.sheet-scroll'), footer:b('.sheet-action'), sheetScrollTop:document.querySelector('.sheet-scroll')?.scrollTop, bodyOverflow:getComputedStyle(document.body).overflow }; }""")
        page.screenshot(path=str(OUT / f'sheet-{mode}.png'), full_page=False)
        print(json.dumps({'mode':mode,'home':geom,'sheet':sheet}, ensure_ascii=False))
        browser.close()

if __name__ == '__main__':
    for mode in (sys.argv[1:] or ['standalone']):
        run(mode)
