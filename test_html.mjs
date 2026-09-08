export default async function run(page, ui) {
  const allLogs = [];
  page.on('console', msg => allLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allLogs.push({ type: 'pageerror', text: err.message, stack: err.stack }));

  await page.goto('http://localhost:3000/test.html');
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => ({
    bodyText: document.body.innerText,
    hasOpenModal: typeof openModal,
    hasLogout: typeof logout,
  }));

  return { result, allLogs };
}
