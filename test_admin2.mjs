export default async function run(page, ui) {
  // Collect console logs from start
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Login
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Go to parcerias page
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Take snapshot before clicking
  const snap = await ui.snapshot();
  
  // Click the add button
  const addBtn = await page.$('button:has-text("+ Adicionar")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // Take snapshot after clicking
  const snapAfter = await ui.snapshot();
  
  return {
    consoleLogs: logs,
    url: page.url(),
    title: await page.title(),
    snapshotBefore: snap,
    snapshotAfter: snapAfter
  };
}
