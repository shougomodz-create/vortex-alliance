export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    const result = [];
    scripts.forEach((s, i) => {
      result.push({
        index: i,
        src: s.src || '(inline)',
        type: s.type || 'default',
        async: s.async,
        defer: s.defer
      });
    });
    return {
      scriptCount: scripts.length,
      scripts: result,
      bodyHTML: document.body.innerHTML.substring(document.body.innerHTML.length - 200)
    };
  });

  return info;
}
