export default async function run(page, ui) {
  // Login
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navegar para parcerias
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Verificar se admin.js carregou
  const adminLoaded = await page.evaluate(() => typeof openModal === 'function');
  
  // Listar todos os scripts
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline');
  });
  
  // Verificar erros
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  // Se adminLoaded é false, tentar carregar manualmente
  if (!adminLoaded) {
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = '/js/admin.js';
      document.body.appendChild(script);
    });
    await page.waitForTimeout(1000);
  }
  
  const adminLoadedAfter = await page.evaluate(() => typeof openModal === 'function');
  
  return { 
    adminLoaded,
    adminLoadedAfter,
    scripts,
    errors
  };
}
