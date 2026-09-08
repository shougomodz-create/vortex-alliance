export default async function run(page, ui) {
  // Login
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Go to parcerias page
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(2000);
  
  // Check console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Click the add button
  const addBtn = await page.$('button:has-text("+ Adicionar")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(1000);
  }
  
  return {
    logs: logs,
    url: page.url(),
    title: await page.title()
  };
}
