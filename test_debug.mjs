export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  const scriptText = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    let text = '';
    scripts.forEach(s => { if (!s.src) text = s.textContent; });
    return text;
  });
  
  // Find the onerror part
  const idx = scriptText.indexOf('onerror');
  if (idx > -1) {
    return { aroundOnerror: scriptText.substring(idx - 20, idx + 60) };
  }
  return { notFound: true, length: scriptText.length };
}
