export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  const scriptText = await page.evaluate(() => {
    return document.querySelector('script').textContent;
  });
  
  // Return lines 7-9 to find the issue around fetchLinkPreview
  const lines = scriptText.split('\n');
  return { 
    line7: lines[6] ? lines[6].substring(0, 500) : 'N/A',
    line8: lines[7] ? lines[7].substring(0, 1000) : 'N/A',
    line9: lines[8] ? lines[8].substring(0, 500) : 'N/A'
  };
}
