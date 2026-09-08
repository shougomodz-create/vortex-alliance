export default async function run(page, ui) {
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
      scriptLength: scriptText.length,
      hasNoneIssue: scriptText.includes("display='none'")
    };
  });
  
  return result;
}
