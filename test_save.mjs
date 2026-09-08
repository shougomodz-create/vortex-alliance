export default async function run(page, ui) {
  const allLogs = [];
  page.on('console', msg => allLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allLogs.push({ type: 'pageerror', text: err.message }));

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

  // Fill the form
  await page.fill('#parceriaNome', 'Teste Parceria');
  await page.fill('#parceriaCategoria', 'Clan');
  await page.fill('#parceriaMembros', '500');
  await page.fill('#parceriaLink', 'https://discord.gg/test');
  
  // Click save
  await page.click('#formParceria button[type="submit"]');
  await page.waitForTimeout(3000);

  return { 
    url: page.url(),
    allLogs
  };
}
