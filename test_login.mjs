export default async function run(page, ui) {
  await page.goto('http://localhost:3000/admin/login');
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => ({
    title: document.title,
    bodyText: document.body.innerText.substring(0, 500),
    turnstile: document.querySelector('.cf-turnstile') ? 'found' : 'missing',
    turnstileScript: !!document.querySelector('script[src*="turnstile"]'),
    submitDisabled: document.getElementById('loginBtn')?.disabled,
    consoleErrors: []
  }));

  page.on('console', msg => {
    if (msg.type() === 'error') info.consoleErrors.push(msg.text());
  });

  await page.waitForTimeout(2000);

  return info;
}
