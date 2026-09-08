export default async function run(page, ui) {
  // Login
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Go to parcerias page
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Check if functions exist
  const result = await page.evaluate(() => {
    return {
      hasOpenModal: typeof openModal === 'function',
      hasCloseModal: typeof closeModal === 'function',
      hasSubmitParceria: typeof submitParceria === 'function',
      hasDOMContentLoaded: document.readyState,
      modalElement: document.getElementById('modalParceria') !== null,
      formElement: document.getElementById('formParceria') !== null
    };
  });
  
  // Try clicking the button directly
  await page.evaluate(() => {
    console.log('[VORTEST] Testing openModal from page context');
    openModal('addParceria');
  });
  await page.waitForTimeout(1000);
  
  // Check if modal is visible
  const modalVisible = await page.evaluate(() => {
    const modal = document.getElementById('modalParceria');
    return modal ? modal.style.display : 'not found';
  });
  
  return {
    functions: result,
    modalVisible: modalVisible
  };
}
