export default async function run(page, ui) {
  // Login
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navegar para parcerias
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Verificar se o script executou
  const scriptResult = await page.evaluate(() => {
    // Verificar se DOMContentLoaded já disparou
    return {
      readyState: document.readyState,
      hasOficiaisData: typeof oficiaisData !== 'undefined',
      hasOpenModal: typeof openModal !== 'undefined',
      bodyChildren: document.body.children.length,
      lastChild: document.body.lastElementChild?.tagName,
      lastChildSrc: document.body.lastElementChild?.src
    };
  });
  
  return scriptResult;
}
