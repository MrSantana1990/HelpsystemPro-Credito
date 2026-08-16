# Arquitetura Inicial

## Direção

A solução começa modular e pode crescer sem reescrever o núcleo financeiro.

```text
Aplicação Web / PWA
        │
        ▼
API autenticada
        │
        ├── Clientes e consentimentos
        ├── Contratos e ciclos
        ├── Livro de movimentações
        ├── Pagamentos e conciliação
        ├── Documentos e comprovantes
        ├── Avisos e filas
        └── Auditoria
        │
        ├── Banco relacional
        ├── Armazenamento de arquivos
        └── Fila de eventos
```

## Decisões fundamentais

### Livro de movimentações

O saldo será resultado de lançamentos, não de edição manual de uma célula. Correções usam eventos compensatórios, preservando a trilha.

### Multiempresa

Cada registro pertence a uma organização. As consultas e permissões sempre respeitam esse limite, preparando o produto para comercialização como SaaS.

### Documentos

Arquivos ficam fora do banco relacional, em armazenamento privado. O banco mantém metadados, vínculo, hash, proprietário e regras de acesso.

### Integrações

WhatsApp, e-mail, SMS, Pix, assinatura e seguros serão adaptadores externos. Uma falha do fornecedor não poderá corromper contratos ou pagamentos.

## Segurança prevista

- autenticação forte e MFA;
- RBAC por organização;
- criptografia TLS e proteção de segredos;
- logs estruturados sem dados sensíveis desnecessários;
- auditoria de ações administrativas;
- backups e testes de restauração;
- proteção contra abuso e limitação de requisições;
- ambientes separados para desenvolvimento, homologação e produção.

## Estado atual

A versão operacional local contém interface React/TypeScript, API Express, autenticação por sessão, banco SQLite e trilha de auditoria. Importação da planilha, comprovantes em arquivo, recuperação assistida e autorização por múltiplas funções ainda estão em desenvolvimento.
