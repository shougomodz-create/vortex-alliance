import { writeFileSync } from 'fs';

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
    const scripts = document.querySelectorAll('script');
    let text = '';
    scripts.forEach(s => { if (!s.src) text = s.textContent; });
    return text;
  });
  
  writeFileSync('C:/Users/Pichau/Desktop/vortex-alliance/extracted_script.js', scriptText);
  
  return { saved: true, length: scriptText.length };
}
