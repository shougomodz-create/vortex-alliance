export default async function run(page, ui) {
  // Login
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navegar para parcerias
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(2000);
  
  // Tirar screenshot antes de clicar
  await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-parcerias-before.png' });
  
  // Verificar se o botão existe
  const addBtn = await page.locator('text=+ Adicionar').first();
  const exists = await addBtn.isVisible();
  
  // Clicar no botão
  if (exists) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-parcerias-modal.png' });
  }
  
  return { 
    url: page.url(), 
    buttonExists: exists,
    bodyText: (await page.textContent('body')).substring(0, 300)
  };
}
