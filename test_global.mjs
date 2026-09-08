export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(4000);

  // Check if admin.js file even exists and loads
  const result = await page.evaluate(() => {
    // Can we access window properties set by admin.js?
    return {
      windowKeys: Object.keys(window).filter(k => k.includes('oficiais') || k.includes('parcerias') || k.includes('afiliados') || k.includes('openModal') || k.includes('logout') || k.includes('dragged')),
      windowType: typeof window,
      documentType: typeof document,
      allScriptTags: Array.from(document.querySelectorAll('script')).map(s => ({ src: s.src, textLen: s.textContent.length })),
    };
  });
  
  // Try to manually load and execute the script
  const scriptContent = await page.evaluate(async () => {
    const res = await fetch('/js/admin.js');
    const text = await res.text();
    return text.substring(0, 200);
  });

  return { ...result, scriptContent };
}
