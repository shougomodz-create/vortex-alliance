export default async function run(page, ui) {
  const responses = [];
  page.on('response', res => {
    if (res.url().includes('admin.js')) {
      responses.push({ url: res.url(), status: res.status(), headers: res.headers() });
    }
  });

  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    bodyText: document.body.innerText.substring(0, 300),
    scriptTags: Array.from(document.querySelectorAll('script')).map(s => ({ src: s.src, textLen: s.textContent.length })),
    hasOpenModal: typeof window.openModal,
    windowKeys: Object.getOwnPropertyNames(window).filter(k => k.includes('open') || k.includes('submit') || k.includes('close')),
  }));

  return { responses, info };
}
