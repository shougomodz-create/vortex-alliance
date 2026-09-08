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
  
  const lines = scriptText.split('\n');
  return { 
    line1: lines[0],
    line2: lines[1] ? lines[1].substring(0, 200) : 'N/A',
    line3: lines[2] ? lines[2].substring(0, 200) : 'N/A',
    totalLines: lines.length
  };
}
