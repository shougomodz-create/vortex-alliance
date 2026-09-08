export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Screenshot of dashboard
  await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-alliance/screenshot_dashboard.png', fullPage: true });
  
  // Go to parcerias and click add
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Click add button via DOM
  await page.click('button:has-text("+ ADICIONAR")');
  await page.waitForTimeout(2000);
  
  // Screenshot with modal
  await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-alliance/screenshot_modal.png', fullPage: true });
  
  // Check if modal is visible via DOM
  const modalDisplay = await page.evaluate(() => {
    const m = document.getElementById('modalParceria');
    return m ? window.getComputedStyle(m).display : 'not found';
  });
  
  return { modalDisplay };
}
