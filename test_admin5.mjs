export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Get the FULL script text and save it
  const scriptText = await page.evaluate(() => {
    return document.querySelector('script').textContent;
  });
  
  // Also check if there are syntax errors by trying to parse it
  const parseResult = await page.evaluate(() => {
    try {
      new Function(document.querySelector('script').textContent);
      return { valid: true };
    } catch(e) {
      return { valid: false, error: e.message, line: e.lineNumber, col: e.columnNumber };
    }
  });
  
  return { parseResult, scriptLength: scriptText.length, last200: scriptText.substring(scriptText.length - 200) };
}
