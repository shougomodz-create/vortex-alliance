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
  await page.waitForTimeout(4000);

  const funcs = await page.evaluate(() => ({
    hasOpenModal: typeof openModal,
    hasLogout: typeof logout,
  }));

  if (funcs.hasOpenModal === 'function') {
    await page.evaluate(() => openModal('addParceria'));
    await page.waitForTimeout(1000);
    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('modalParceria');
      return m ? m.style.display : 'not found';
    });
    funcs.modalVisible = modalVisible;
    await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-alliance/screenshot_modal.png', fullPage: true });
  }

  return { funcs, allLogs };
}
