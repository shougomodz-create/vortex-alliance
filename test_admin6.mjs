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
  
  // Search for 'none' near problematic quotes
  const lines = scriptText.split('\n');
  const noneLines = [];
  lines.forEach((line, i) => {
    if (line.includes('none')) {
      noneLines.push({ lineNum: i + 1, content: line.substring(0, 300) });
    }
  });
  
  return { noneLines };
}
