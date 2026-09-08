export default async function run(page, ui) {
  // Login
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navegar para parcerias
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Verificar erros no console
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  // Verificar se admin.js carregou
  const adminLoaded = await page.evaluate(() => typeof openModal === 'function');
  
  // Tentar chamar openModal diretamente
  const modalExists = await page.evaluate(() => {
    const modal = document.getElementById('modalParceria');
    return modal !== null;
  });
  
  // Chamar openModal via evaluate
  await page.evaluate(() => {
    if (typeof openModal === 'function') {
      openModal('addParceria');
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Verificar se modal abriu
  const modalVisible = await page.evaluate(() => {
    const modal = document.getElementById('modalParceria');
    return modal ? modal.style.display : 'not found';
  });
  
  await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-debug.png' });
  
  return { 
    adminLoaded,
    modalExists,
    modalVisible,
    errors: errors.slice(0, 5)
  };
}
