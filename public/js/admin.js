function logout(){fetch('/admin/logout',{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'include'}).then(function(){window.location.href='/admin/login'})}
function openModal(t){
  var map={'addOficial':'modalOficial','addParceria':'modalParceria','addAfiliado':'modalAfiliado'};
  var mid=map[t];
  if(!mid)return;
  var el=document.getElementById(mid);
  if(!el)return;
  if(t==='addOficial'){
    document.getElementById('oficialId').value='';
    document.getElementById('oficialNome').value='';
    document.getElementById('oficialCargo').value='';
    document.getElementById('oficialDescricao').value='';
    document.getElementById('oficialDiscord').value='';
    document.getElementById('oficialWhatsapp').value='';
    document.getElementById('oficialInstagram').value='';
    document.getElementById('oficialOrdem').value='0';
    document.getElementById('oficialAvatar').value='';
    document.getElementById('oficialAtivo').checked=true;
    document.getElementById('modalOficialTitle').textContent='Adicionar Oficial';
  }else if(t==='addParceria'){
    document.getElementById('parceriaId').value='';
    document.getElementById('parceriaNome').value='';
    document.getElementById('parceriaCategoria').value='';
    document.getElementById('parceriaDescricao').value='';
    document.getElementById('parceriaLink').value='';
    document.getElementById('parceriaLinkInput').value='';
    document.getElementById('parceriaWhatsapp').value='';
    document.getElementById('parceriaMembros').value='';
    document.getElementById('parceriaPlataforma').value='Discord';
    document.getElementById('parceriaOrdem').value='0';
    document.getElementById('parceriaLogo').value='';
    document.getElementById('parceriaAtivo').checked=true;
    document.getElementById('parceriaVip').checked=false;
    document.getElementById('parceriaPreview').innerHTML='';
    document.getElementById('modalParceriaTitle').textContent='Adicionar Parceria';
  }else if(t==='addAfiliado'){
    document.getElementById('afiliadoId').value='';
    document.getElementById('afiliadoNome').value='';
    document.getElementById('afiliadoCategoria').value='';
    document.getElementById('afiliadoDescricao').value='';
    document.getElementById('afiliadoLink').value='';
    document.getElementById('afiliadoLinkInput').value='';
    document.getElementById('afiliadoWhatsapp').value='';
    document.getElementById('afiliadoMembros').value='';
    document.getElementById('afiliadoPlataforma').value='Discord';
    document.getElementById('afiliadoOrdem').value='0';
    document.getElementById('afiliadoLogo').value='';
    document.getElementById('afiliadoAtivo').checked=true;
    document.getElementById('afiliadoVip').checked=false;
    document.getElementById('afiliadoPreview').innerHTML='';
    document.getElementById('modalAfiliadoTitle').textContent='Adicionar Afiliado';
  }
  el.style.display='flex';
}
function closeModal(id){var m=document.getElementById(id);if(m)m.style.display='none'}
document.addEventListener('click',function(e){if(e.target.classList.contains('modal'))e.target.style.display='none'});

function fetchLinkPreview(url,type){
  if(!url)return;
  var pv=document.getElementById(type+'Preview');
  if(!pv)return;
  pv.innerHTML='<p>Carregando...</p>';
  var platform='web';
  if(url.indexOf('discord')>-1)platform='discord';
  else if(url.indexOf('wa.me')>-1||url.indexOf('whatsapp')>-1)platform='whatsapp';
  else if(url.indexOf('instagram')>-1)platform='instagram';
  else if(url.indexOf('youtube')>-1)platform='youtube';
  fetch('/api/preview?url='+encodeURIComponent(url)+'&platform='+platform).then(function(r){return r.json()}).then(function(d){
    if(d.error){pv.innerHTML='<p>Preencha manualmente.</p>';return}
    if(d.nome){var f=document.getElementById(type+'Nome');if(f)f.value=d.nome}
    if(d.descricao){var f=document.getElementById(type+'Descricao');if(f)f.value=d.descricao}
    if(d.logo){var f=document.getElementById(type+'Logo');if(f)f.value=d.logo}
    if(d.tipo){var f=document.getElementById(type+'Categoria');if(f)f.value=d.tipo}
    if(d.membros){var f=document.getElementById(type+'Membros');if(f)f.value=d.membros}
    if(d.plataforma){var f=document.getElementById(type+'Plataforma');if(f)f.value=d.plataforma}
    var lnk=document.getElementById(type+'Link');
    if(lnk)lnk.value=url;
    var html='<div class="preview-card">';
    if(d.logo)html+='<img src="'+d.logo+'" class="preview-image" onerror="this.style.display=&quot;none&quot;">';
    html+='<div class="preview-info"><h4>'+d.nome+'</h4>';
    if(d.membros)html+='<span>👥 '+Number(d.membros).toLocaleString('pt-BR')+' membros</span>';
    if(d.tipo)html+='<span>'+d.tipo+'</span>';
    if(d.plataforma)html+='<span>📡 '+d.plataforma+'</span>';
    if(d.descricao)html+='<p>'+d.descricao+'</p>';
    html+='</div></div>';
    pv.innerHTML=html;
  }).catch(function(){pv.innerHTML='<p>Erro ao buscar.</p>'});
}

function deleteItem(type,id){
  if(!confirm('Tem certeza que deseja excluir?'))return;
  fetch('/admin/api/'+type+'/'+id,{method:'DELETE',headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'include'}).then(function(r){if(r.ok)window.location.reload()});
}

function editOficial(id){
  fetch('/api/oficiais').then(function(r){return r.json()}).then(function(list){
    var item=null;for(var i=0;i<list.length;i++){if(list[i].id===id){item=list[i];break}}
    if(!item)return;
    document.getElementById('oficialId').value=item.id;
    document.getElementById('oficialNome').value=item.nome||'';
    document.getElementById('oficialCargo').value=item.cargo||'';
    document.getElementById('oficialDescricao').value=item.descricao||'';
    document.getElementById('oficialDiscord').value=item.discord||'';
    document.getElementById('oficialWhatsapp').value=item.whatsapp||'';
    document.getElementById('oficialInstagram').value=item.instagram||'';
    document.getElementById('oficialOrdem').value=item.ordem||0;
    document.getElementById('oficialAvatar').value=item.avatar||'';
    document.getElementById('oficialAtivo').checked=!!item.ativo;
    document.getElementById('modalOficialTitle').textContent='Editar Oficial';
    openModal('addOficial');
  });
}

function editParceria(id){
  fetch('/api/parcerias').then(function(r){return r.json()}).then(function(list){
    var item=null;for(var i=0;i<list.length;i++){if(list[i].id===id){item=list[i];break}}
    if(!item)return;
    document.getElementById('parceriaId').value=item.id;
    document.getElementById('parceriaNome').value=item.nome||'';
    document.getElementById('parceriaCategoria').value=item.categoria||item.tipo||'';
    document.getElementById('parceriaDescricao').value=item.descricao||'';
    document.getElementById('parceriaLink').value=item.link||'';
    document.getElementById('parceriaWhatsapp').value=item.whatsapp||'';
    document.getElementById('parceriaMembros').value=item.membros||'';
    document.getElementById('parceriaPlataforma').value=item.plataforma||'Discord';
    document.getElementById('parceriaOrdem').value=item.ordem||0;
    document.getElementById('parceriaLogo').value=item.logo||'';
    document.getElementById('parceriaAtivo').checked=!!item.ativo;
    document.getElementById('parceriaVip').checked=!!item.vip;
    document.getElementById('modalParceriaTitle').textContent='Editar Parceria';
    openModal('addParceria');
  });
}

function editAfiliado(id){
  fetch('/api/afiliados').then(function(r){return r.json()}).then(function(list){
    var item=null;for(var i=0;i<list.length;i++){if(list[i].id===id){item=list[i];break}}
    if(!item)return;
    document.getElementById('afiliadoId').value=item.id;
    document.getElementById('afiliadoNome').value=item.nome||'';
    document.getElementById('afiliadoCategoria').value=item.categoria||item.tipo||'';
    document.getElementById('afiliadoDescricao').value=item.descricao||'';
    document.getElementById('afiliadoLink').value=item.link||'';
    document.getElementById('afiliadoWhatsapp').value=item.whatsapp||'';
    document.getElementById('afiliadoMembros').value=item.membros||'';
    document.getElementById('afiliadoPlataforma').value=item.plataforma||'Discord';
    document.getElementById('afiliadoOrdem').value=item.ordem||0;
    document.getElementById('afiliadoLogo').value=item.logo||'';
    document.getElementById('afiliadoAtivo').checked=!!item.ativo;
    document.getElementById('afiliadoVip').checked=!!item.vip;
    document.getElementById('modalAfiliadoTitle').textContent='Editar Afiliado';
    openModal('addAfiliado');
  });
}

function submitOficial(){
  var id=document.getElementById('oficialId').value;
  var fd=new FormData();
  fd.append('nome',document.getElementById('oficialNome').value);
  fd.append('cargo',document.getElementById('oficialCargo').value);
  fd.append('descricao',document.getElementById('oficialDescricao').value);
  fd.append('discord',document.getElementById('oficialDiscord').value);
  fd.append('whatsapp',document.getElementById('oficialWhatsapp').value);
  fd.append('instagram',document.getElementById('oficialInstagram').value);
  fd.append('ordem',document.getElementById('oficialOrdem').value);
  fd.append('avatar',document.getElementById('oficialAvatar').value);
  fd.append('ativo',document.getElementById('oficialAtivo').checked?'true':'false');
  var fi=document.getElementById('oficialAvatarFile');
  if(fi&&fi.files[0])fd.append('avatarFile',fi.files[0]);
  fetch(id?'/admin/api/oficiais/'+id:'/admin/api/oficiais',{method:id?'PUT':'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'include'}).then(function(r){if(r.ok)window.location.reload();else alert('Erro ao salvar')});
}

function submitParceria(){
  var id=document.getElementById('parceriaId').value;
  var fd=new FormData();
  fd.append('nome',document.getElementById('parceriaNome').value);
  fd.append('tipo',document.getElementById('parceriaCategoria').value);
  fd.append('descricao',document.getElementById('parceriaDescricao').value);
  fd.append('link',document.getElementById('parceriaLink').value);
  fd.append('whatsapp',document.getElementById('parceriaWhatsapp').value);
  fd.append('membros',document.getElementById('parceriaMembros').value);
  fd.append('plataforma',document.getElementById('parceriaPlataforma').value);
  fd.append('categoria',document.getElementById('parceriaCategoria').value);
  fd.append('ordem',document.getElementById('parceriaOrdem').value);
  fd.append('logo',document.getElementById('parceriaLogo').value);
  fd.append('ativo',document.getElementById('parceriaAtivo').checked?'true':'false');
  fd.append('vip',document.getElementById('parceriaVip').checked?'true':'false');
  var fi=document.getElementById('parceriaLogoFile');
  if(fi&&fi.files[0])fd.append('logoFile',fi.files[0]);
  fetch(id?'/admin/api/parcerias/'+id:'/admin/api/parcerias',{method:id?'PUT':'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'include'}).then(function(r){if(r.ok)window.location.reload();else alert('Erro ao salvar')});
}

function submitAfiliado(){
  var id=document.getElementById('afiliadoId').value;
  var fd=new FormData();
  fd.append('nome',document.getElementById('afiliadoNome').value);
  fd.append('tipo',document.getElementById('afiliadoCategoria').value);
  fd.append('descricao',document.getElementById('afiliadoDescricao').value);
  fd.append('link',document.getElementById('afiliadoLink').value);
  fd.append('whatsapp',document.getElementById('afiliadoWhatsapp').value);
  fd.append('membros',document.getElementById('afiliadoMembros').value);
  fd.append('plataforma',document.getElementById('afiliadoPlataforma').value);
  fd.append('categoria',document.getElementById('afiliadoCategoria').value);
  fd.append('ordem',document.getElementById('afiliadoOrdem').value);
  fd.append('logo',document.getElementById('afiliadoLogo').value);
  fd.append('ativo',document.getElementById('afiliadoAtivo').checked?'true':'false');
  fd.append('vip',document.getElementById('afiliadoVip').checked?'true':'false');
  var fi=document.getElementById('afiliadoLogoFile');
  if(fi&&fi.files[0])fd.append('logoFile',fi.files[0]);
  fetch(id?'/admin/api/afiliados/'+id:'/admin/api/afiliados',{method:id?'PUT':'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'include'}).then(function(r){if(r.ok)window.location.reload();else alert('Erro ao salvar')});
}

function submitSettings(){
  var fd={};
  document.querySelectorAll('[id^="setting_"]').forEach(function(i){fd[i.id]=i.value});
  fetch('/admin/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},credentials:'include',body:JSON.stringify(fd)}).then(function(r){if(r.ok)alert('Salvo!');else alert('Erro')});
}

var draggedItem=null;
function initDragReorder(tableId,type){
  var tbody=document.querySelector('#'+tableId+' tbody');
  if(!tbody)return;
  tbody.querySelectorAll('tr').forEach(function(row){
    row.draggable=true;
    row.style.cursor='grab';
    row.addEventListener('dragstart',function(e){draggedItem=row;row.style.opacity='0.5'});
    row.addEventListener('dragend',function(){row.style.opacity='1'});
    row.addEventListener('dragover',function(e){e.preventDefault()});
    row.addEventListener('drop',function(e){
      e.preventDefault();
      if(!draggedItem||draggedItem===row)return;
      var rows=Array.from(tbody.querySelectorAll('tr'));
      var di=rows.indexOf(draggedItem),di2=rows.indexOf(row);
      if(di<di2)row.parentNode.insertBefore(draggedItem,row.nextSibling);
      else row.parentNode.insertBefore(draggedItem,row);
      var updates=[];
      tbody.querySelectorAll('tr').forEach(function(r,i){if(r.dataset.id)updates.push({id:parseInt(r.dataset.id),ordem:i})});
      fetch('/admin/api/'+type+'/reorder',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},credentials:'include',body:JSON.stringify({items:updates})});
    });
  });
}

(function(){
  var p=window.location.pathname;
  if(p.indexOf('/oficiais')>-1)initDragReorder('oficiaisTable','oficiais');
  else if(p.indexOf('/parcerias')>-1)initDragReorder('parceriasTable','parcerias');
  else if(p.indexOf('/afiliados')>-1)initDragReorder('afiliadosTable','afiliados');
})();
