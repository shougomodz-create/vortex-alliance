# ⚔ ALIANÇA UNION - Sistema Completo

Sistema de gerenciamento para a Aliança UNION com tema dark gótico (roxo, dourado e preto).

## Funcionalidades

- **Landing Page** com tema dark gótico profissional
- **Painel Administrativo** completo
- **Gerenciamento de Oficiais** (liderança)
- **Gerenciamento de Parcerias**
- **Gerenciamento de Afiliados**
- **Sistema VIP** com destaque
- **Configurações do Site** editáveis pelo painel
- **Upload de Imagens** para avatares e logos
- **Sistema de Autenticação** seguro com JWT
- **CAPTCHA Turnstile** Cloudflare

## Instalação

```bash
npm install
```

### Configurar ambiente

```bash
cp .env.example .env
```

### Iniciar o servidor

```bash
npm start
```

### Acessar

- **Site:** http://localhost:3000
- **Painel Admin:** http://localhost:3000/admin

### Credenciais padrão

- **Usuário:** vtxadm
- **Senha:** VTX2K27

## Estrutura do Projeto

```
├── public/
│   ├── css/
│   │   ├── style.css      # Estilos do site principal
│   │   └── admin.css      # Estilos do painel admin
│   ├── js/
│   │   ├── main.js        # JavaScript do site
│   │   └── admin.js       # JavaScript do painel
│   └── images/            # Imagens e uploads
├── src/
│   ├── server.js          # Servidor principal
│   ├── database.js        # Configuração do banco Neon PostgreSQL
│   ├── routes/
│   │   ├── api.js         # Rotas da API pública
│   │   └── admin.js       # Rotas do painel admin
│   └── middleware/
│       └── auth.js        # Middleware de autenticação
├── .env.example           # Exemplo de configuração
├── package.json
└── README.md
```

## Licença

MIT License
