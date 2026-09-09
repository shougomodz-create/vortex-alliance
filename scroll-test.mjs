export default async function run(page, ui) {
  await page.evaluate(() => {
    document.querySelector('#afiliados').scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(500);
  const rect = await page.evaluate(() => {
    const el = document.querySelector('#afiliados');
    const r = el.getBoundingClientRect();
    return { top: r.top, height: r.height, width: r.width };
  });
  return rect;
}
