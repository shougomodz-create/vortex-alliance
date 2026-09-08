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
  
  // Check for hidden/special characters in the script
  const chars = [];
  for (let i = 0; i < Math.min(scriptText.length, 500); i++) {
    const c = scriptText.charCodeAt(i);
    if (c > 127 || (c < 32 && c !== 10 && c !== 13 && c !== 9)) {
      chars.push({ pos: i, char: c, hex: '0x' + c.toString(16) });
    }
  }
  
  return { 
    specialChars: chars,
    first500: scriptText.substring(0, 500)
  };
}
