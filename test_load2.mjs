export default async function run(page, ui) {
  const allLogs = [];
  page.on('console', msg => allLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allLogs.push({ type: 'pageerror', text: err.message }));
  
  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure().errorText }));

  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(4000);

  const funcs = await page.evaluate(() => ({
    hasOpenModal: typeof openModal,
    hasCloseModal: typeof closeModal,
    hasSubmitParceria: typeof submitParceria,
    hasLogout: typeof logout,
    hasInitDragReorder: typeof initDragReorder,
  }));

  return { funcs, allLogs, failedRequests };
}
