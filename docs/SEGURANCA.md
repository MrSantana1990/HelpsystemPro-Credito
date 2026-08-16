# Segurança e Privacidade

## Controles implementados

- senha armazenada com `scrypt` e salt aleatório;
- sessão aleatória armazenada no banco somente como hash;
- cookie `HttpOnly` e `SameSite=Strict`;
- opção de cookie `Secure` em produção;
- limite de tentativas de login;
- política de origem para operações de escrita;
- Content Security Policy e cabeçalhos de proteção;
- banco SQLite com chaves estrangeiras e modo WAL;
- valores financeiros em centavos inteiros;
- transações atômicas nas operações compostas;
- trilha de auditoria;
- importação com hash contra duplicidade;
- backups com verificação de integridade;
- restauração somente com o servidor fechado;
- container sem privilégios adicionais.

## Responsabilidades operacionais

- HTTPS é obrigatório na internet.
- A porta interna não deve ser publicada diretamente.
- Backups devem ser criptografados e testados.
- O servidor e o Node.js devem receber atualizações.
- O acesso ao painel deve ser limitado às pessoas necessárias.
- Dados pessoais devem ter finalidade, retenção e descarte definidos.
- Incidentes precisam de procedimento documentado.

## Limites atuais

- autenticação multifator ainda não está integrada;
- recibos não usam certificado ICP-Brasil;
- não há integração automática com bureaus, Pix, WhatsApp ou seguradora;
- o produto não substitui revisão jurídica, contábil ou regulatória;
- SQLite exige uma única instância da aplicação.

## Dados que não entram no Git

- banco de produção;
- planilhas reais;
- documentos e comprovantes;
- arquivos `.env`;
- backups;
- tokens e credenciais.

