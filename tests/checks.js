const { chromium } = require('playwright');
const URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });

    const results = [];

    // Check hero heading
    const heroExists = await page.$eval('.hero-content h1', el => !!el.textContent.trim()).catch(() => false);
    results.push({ check: 'hero heading present', ok: !!heroExists });

    // Check buttons exist
    const primaryBtn = await page.$('.cta .btn.primary');
    const ghostBtn = await page.$('.cta .btn.ghost');
    results.push({ check: 'primary CTA exists', ok: !!primaryBtn });
    results.push({ check: 'ghost CTA exists', ok: !!ghostBtn });

    // Button padding and centering checks
    const btns = await page.$$('.btn');
    for (const btn of btns) {
      const style = await btn.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          paddingLeft: parseFloat(cs.paddingLeft),
          paddingRight: parseFloat(cs.paddingRight),
          textAlign: cs.textAlign,
          minWidth: parseFloat(cs.minWidth) || 0,
          whiteSpace: cs.whiteSpace
        };
      });
      const okPadding = style.paddingLeft >= 8 && style.paddingRight >= 8;
      const okMinWidth = style.minWidth >= 60;
      const okNoWrap = style.whiteSpace.indexOf('nowrap') !== -1;
      results.push({ check: 'button padding >=8px', ok: okPadding, details: style });
      results.push({ check: 'button minWidth >=60px', ok: okMinWidth, details: style });
      results.push({ check: 'button nowrap', ok: okNoWrap, details: style });
    }

    // Contact form exists and has netlify attribute
    const formExists = await page.$eval('form.contact-form', el => el.getAttribute('data-netlify') === 'true').catch(() => false);
    results.push({ check: 'contact form Netlify enabled', ok: !!formExists });

    // Images have alt attributes
    const imgs = await page.$$eval('img', nodes => nodes.map(n => ({ src: n.getAttribute('src'), alt: n.getAttribute('alt') })));
    const missingAlts = imgs.filter(i => !i.alt || i.alt.trim() === '');
    results.push({ check: 'images have alt', ok: missingAlts.length === 0, details: missingAlts.slice(0,5) });

    // Console errors
    results.push({ check: 'no console errors', ok: consoleErrors.length === 0, details: consoleErrors.slice(0,5) });

    // Report
    let failed = 0;
    console.log('UI checks:');
    for (const r of results) {
      const mark = r.ok ? 'OK' : 'FAIL';
      if (!r.ok) failed++;
      console.log(`- ${mark} - ${r.check}${r.details ? ' - ' + JSON.stringify(r.details) : ''}`);
    }

    if (failed > 0) {
      console.error(`\n${failed} checks failed.`);
      process.exit(2);
    }

    console.log('\nAll checks passed.');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Error running checks:', e);
    await browser.close();
    process.exit(3);
  }
})();
