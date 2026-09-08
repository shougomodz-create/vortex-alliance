export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);

  const formInfo = await page.evaluate(() => {
    const form = document.getElementById('formParceria');
    if (!form) return { error: 'formParceria not found' };
    
    const inputs = form.querySelectorAll('input, select, textarea');
    const ids = [];
    inputs.forEach(el => ids.push({ tag: el.tagName, id: el.id, type: el.type || 'text', name: el.name }));
    
    return {
      formExists: true,
      formAction: form.action,
      inputs: ids,
      hasSubmitListener: typeof submitParceria
    };
  });

  return formInfo;
}
