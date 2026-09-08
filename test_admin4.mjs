export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Get the raw HTML of the script tag
  const scriptInfo = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    const info = [];
    scripts.forEach((s, i) => {
      info.push({
        index: i,
        src: s.src || '(inline)',
        type: s.type || 'default',
        length: s.textContent.length,
        first200: s.textContent.substring(0, 200),
        hasOpenModal: s.textContent.includes('openModal'),
        hasDOMContentLoaded: s.textContent.includes('DOMContentLoaded')
      });
    });
    return {
      scriptCount: scripts.length,
      scripts: info,
      hasOpenModalGlobal: typeof openModal,
      bodyHTML_length: document.body.innerHTML.length
    };
  });
  
  return scriptInfo;
}
