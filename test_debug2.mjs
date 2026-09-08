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
  
  // Return full script in parts
  return { 
    part1: scriptText.substring(0, 2000),
    part2: scriptText.substring(2000, 4000),
    part3: scriptText.substring(4000, 6000),
    part4: scriptText.substring(6000)
  };
}
