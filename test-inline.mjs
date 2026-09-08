export default async function run(page, ui) {
  // Login
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navegar para parcerias
  await page.goto('http://localhost:3000/admin/parcerias');
  await page.waitForTimeout(3000);
  
  // Injetar script inline
  await page.evaluate(() => {
    window.openModal = function(type) {
      const modalMap = {
        'addOficial': { modal: 'modalOficial', prefix: 'oficial', title: 'Oficial' },
        'addParceria': { modal: 'modalParceria', prefix: 'parceria', title: 'Parceria' },
        'addAfiliado': { modal: 'modalAfiliado', prefix: 'afiliado', title: 'Afiliado' }
      };
      
      const config = modalMap[type];
      if (!config) return;
      
      const modal = document.getElementById(config.modal);
      if (modal) modal.style.display = 'flex';
    };
    
    window.closeModal = function(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.style.display = 'none';
    };
    
    window.deleteItem = function(type, id) {
      if (!confirm('Tem certeza que deseja excluir este item?')) return;
      fetch(`/admin/api/${type}/${id}`, { method: 'DELETE' })
        .then(res => { if (res.ok) window.location.reload(); });
    };
  });
  
  // Agora verificar se openModal funciona
  const works = await page.evaluate(() => typeof openModal === 'function');
  
  // Chamar openModal
  await page.evaluate(() => openModal('addParceria'));
  await page.waitForTimeout(500);
  
  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('modalParceria');
    return m ? m.style.display : 'not found';
  });
  
  await page.screenshot({ path: 'C:/Users/Pichau/Desktop/vortex-modal-working.png' });
  
  return { works, modalVisible };
}
