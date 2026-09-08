export default async function run(page, ui) {
  // Preencher formulário
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  
  // Clicar no botão
  await page.click('button[type="submit"]');
  
  // Aguardar
  await page.waitForTimeout(3000);
  
  return { url: page.url() };
}
