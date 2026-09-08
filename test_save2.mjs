export default async function run(page, ui) {
  const allLogs = [];
  page.on('console', msg => allLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allLogs.push({ type: 'pageerror', text: err.message }));

  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure().errorText }));
  
  const responses = [];
  page.on('response', res => {
    if (res.url().includes('/admin/api/')) {
      responses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);

  // Click add button
  await page.click('button:has-text("+ ADICIONAR")');
  await page.waitForTimeout(1000);

  // Fill form
  await page.fill('#parceriaNome', 'Teste Parceria 2');
  await page.fill('#parceriaLink', 'https://discord.gg/test2');
  await page.fill('#parceriaMembros', '100');
  
  // Click save button via evaluate to ensure onclick fires
  await page.evaluate(() => {
    submitParceria({ preventDefault: function(){} });
  });
  await page.waitForTimeout(3000);

  return { 
    url: page.url(),
    responses,
    failedRequests,
    allLogs
  };
}
