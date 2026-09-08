# ⚔ ALIANÇA VORTEX - Sistema Completo

Sistema de gerenciamento para a Aliança VORTEX com tema gótico (vermelho, branco e preto).

## 📋 Funcionalidades

- **Landing Page** com tema gótico profissional
- **Painel Administrativo** completo
- **Gerenciamento de Oficiais** (liderança)
- **Gerenciamento de Parcerias**
- **Gerenciamento de Afiliados**
- **Contador de Visitas** (total e hoje)
- **Configurações do Site** editáveis pelo painel
- **Upload de Imagens** para avatares e logos
- **Sistema de Autenticação** seguro
- **Proteção contra DDoS** com rate limiting

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd vortex-alliance
npm install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` se necessário.

### 3. Iniciar o servidor

```bash
npm start
```

Ou para desenvolvimento com auto-reload:

```bash
npm run dev
```

### 4. Acessar

- **Site:** http://localhost:3000
- **Painel Admin:** http://localhost:3000/admin

### 5. Credenciais padrão

- **Usuário:** admin
- **Senha:** admin123

> ⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

## 🛡 Proteção Cloudflare (DDoS)

Para proteção contra ataques DDoS em produção:

### 1. Criar conta no Cloudflare

Acesse [cloudflare.com](https://cloudflare.com) e crie uma conta gratuita.

### 2. Adicionar domínio

1. Adicione seu domínio ao Cloudflare
2. Atualize os nameservers no seu registrador de domínio

### 3. Configurar DNS

No painel do Cloudflare, configure:

| Tipo | Nome | Valor | Proxy |
|------|------|-------|-------|
| A | @ | IP do seu servidor | ☁️ Ligado |
| CNAME | www | seu-dominio.com | ☁️ Ligado |

### 4. Configurações de Segurança

No painel do Cloudflare, vá em **Security** e ative:

- **Bot Fight Mode:** ON
- **Under Attack Mode:** ON (apenas se estiver sofrendo ataque)
- **Security Level:** Medium ou High

### 5. Regras de Firewall (Opcional)

Crie regras para bloquear IPs suspeitos:

```
( ip.geoip.country ne "BR" and not http.request.uri.path contains "/admin" )
```

Ação: Challenge (CAPTCHA)

### 6. Rate Limiting no Cloudflare

Vá em **Security > WAF > Rate Limiting**:

- **Regra:** 100 requests por minuto por IP
- **Ação:** Block por 10 minutos

### 7. SSL/TLS

No painel do Cloudflare:
- **SSL/TLS:** Full (Strict)
- **Always Use HTTPS:** ON
- **Automatic HTTPS Rewrites:** ON

## 📁 Estrutura do Projeto

```
vortex-alliance/
├── public/
│   ├── css/
│   │   ├── style.css      # Estilos do site principal
│   │   └── admin.css      # Estilos do painel admin
│   ├── js/
│   │   ├── main.js        # JavaScript do site
│   │   └── admin.js       # JavaScript do painel
│   └── images/            # Upload de imagens
├── src/
│   ├── server.js          # Servidor principal
│   ├── database.js        # Configuração do banco SQLite
│   ├── routes/
│   │   ├── api.js         # Rotas da API pública
│   │   └── admin.js       # Rotas do painel admin
│   └── middleware/
│       └── auth.js        # Middleware de autenticação
├── data/
│   └── vortex.db          # Banco de dados SQLite
├── .env.example           # Exemplo de configuração
├── package.json
└── README.md
```

## 🔧 Comandos Úteis

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Desenvolvimento com auto-reload
npm run dev

# Limpar banco e recomeçar
rm data/vortex.db
npm start
```

## 🎨 Personalização

### Cores

Edite as variáveis CSS no arquivo `public/css/style.css`:

```css
:root {
  --accent-red: #c41e3a;      /* Vermelho principal */
  --accent-red-dark: #8b0000; /* Vermelho escuro */
  --bg-primary: #0a0a0a;      /* Fundo principal */
  --text-primary: #ffffff;    /* Texto principal */
}
```

### Fontes

O site usa as fontes **Cinzel** e **Cinzel Decorative** do Google Fonts (tema gótico).

Para alterar, edite o link no HTML gerado em `src/server.js`.

## 📝 Licença

MIT License - Uso livre
