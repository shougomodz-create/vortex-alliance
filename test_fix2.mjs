export default async function run(page, ui) {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    let scriptText = '';
    scripts.forEach(s => { if (!s.src) scriptText = s.textContent; });
    
    try { new Function(scriptText); var syntax = 'VALID'; } catch(e) { var syntax = e.message; }
    
    return {
      hasOpenModal: typeof openModal,
      hasCloseModal: typeof closeModal,
      syntaxCheck: syntax,
      scriptLength: scriptText.length
    };
  });

  // Try clicking the add button
  if (result.hasOpenModal === 'function') {
    await page.evaluate(() => openModal('addParceria'));
    await page.waitForTimeout(1000);
    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('modalParceria');
      return m ? m.style.display : 'not found';
    });
    result.modalVisible = modalVisible;
  }

  return { ...result, consoleLogs };
}
