<div align="center">

# 💠 HelpSystemPro Crédito

### Gestão de crédito simples para operar. Poderosa para crescer.

Clientes, contratos, pagamentos, renovações, documentos e decisões em uma experiência feita primeiro para celular.

[![Produção](https://img.shields.io/badge/produção-online-22c55e?style=for-the-badge)](https://credito.helpsystempro.site)
[![Status](https://img.shields.io/badge/status-MVP_operacional-22d3d3?style=for-the-badge)](#-estado-atual)
[![Interface](https://img.shields.io/badge/mobile--first-PWA-8b5cf6?style=for-the-badge)](#-experiência)
[![Segurança](https://img.shields.io/badge/dados-protegidos-0f766e?style=for-the-badge)](#-segurança-e-privacidade)

[Abrir sistema](https://credito.helpsystempro.site) · [Visão](docs/VISAO-DO-PRODUTO.md) · [Regras](docs/REGRAS-DE-NEGOCIO.md) · [Operação](docs/OPERACAO.md)

</div>

---

## ✦ Propósito

Transformar uma operação real controlada em planilha em um sistema confiável, auditável e agradável — preservando integralmente a base e a história que deram origem ao produto.

## ✅ Estado atual

- administrador inicial e login protegido;
- gestão de clientes, contratos e ciclos;
- pagamentos, amortizações e quitações;
- renovação mediante pagamento de juros;
- renegociação vinculando contrato anterior e novo;
- multas, estornos e histórico auditável;
- recibos com código de conferência;
- importação assistida da planilha e bloqueio de duplicidade;
- anexos criptografados e portal do cliente;
- score interno explicável e limite recomendado;
- solicitações após quitação individual;
- vencimentos quinzenais no dia 15 ou final do mês;
- backup verificado e restauração;
- interface responsiva para celular.

## 🧭 Experiência

### Simples na frente, rigoroso por trás

Quando o cliente paga somente os juros:

    Recebimento: R$ 300,00
    Aplicação: juros do ciclo
    Principal preservado: R$ 1.000,00
    Novo vencimento: +30 dias

O sistema encerra o ciclo anterior, cria o próximo e liga os registros. Nada é apagado.

## 🔄 Regras essenciais

| Operação | Tratamento | Resultado |
|---|---|---|
| **Somente juros** | Recebe o juro do ciclo | Principal preservado e novo ciclo |
| **Amortização** | Reduz parte do principal | Próximo ciclo sobre saldo menor |
| **Quitação** | Liquida encargos e principal | Contrato encerrado |
| **Renegociação** | Recalcula saldo e condições | Novo contrato ligado ao anterior |
| **Estorno** | Reverte de forma controlada | Histórico e auditoria preservados |

## 👥 Dois lados da plataforma

| Credor/fornecedor | Cliente/tomador |
|---|---|
| Carteira, capital e lucro | Contratos e vencimentos próprios |
| Risco, recorrência e margem | Solicitação de novo empréstimo |
| Convites de cadastro | Envio seguro de documentos |
| Aprovação e limites | Recibos e comprovantes |
| Cobrança e alertas | Atualização cadastral |

O cadastro se adapta à origem de renda — CLT, autônomo, benefício, MEI/empresa ou outra — solicitando os comprovantes adequados.

## 🗺️ Roteiro

| Fase | Entrega | Situação |
|---:|---|:---:|
| 1 | Visão, regras e interface | ✅ |
| 2 | Clientes, contratos e pagamentos | ✅ |
| 3 | Renovações, recibos, importação e backup | ✅ |
| 4 | Documentos, portal e avisos | 🟡 |
| 5 | Pix e conciliação por parceiro autorizado | ⚪ |
| 6 | Multiempresa e administração SaaS | ⚪ |
| 7 | Score comportamental explicável | ✅ |
| 8 | Bureau, garantias e seguros | ⚪ |

## 🧱 Fundação técnica

React · TypeScript · Vite · Node.js · Express · SQLite · Docker

Valores financeiros são armazenados em centavos inteiros para evitar erros de arredondamento.

## 🚀 Desenvolvimento

    npm install
    npm run typecheck
    npm test
    npm run build
    npm start

Acesse http://localhost:8091 ou execute INICIAR_SISTEMA.bat no Windows.

## 🛡️ Segurança e privacidade

- trilha de auditoria;
- documentos criptografados;
- HTTPS e camada adicional de acesso;
- backups testados;
- consentimento e retenção de dados;
- nenhuma senha ou documento no Git;
- integrações financeiras somente por parceiros autorizados.

Antes de dados reais, siga o [checklist de produção](docs/CHECKLIST-PRODUCAO.md) e faça validação jurídica e de LGPD.

## 📚 Documentação

| Documento | Conteúdo |
|---|---|
| [Visão do produto](docs/VISAO-DO-PRODUTO.md) | Produto, usuários e evolução |
| [Regras de negócio](docs/REGRAS-DE-NEGOCIO.md) | Cálculos e eventos financeiros |
| [Arquitetura](docs/ARQUITETURA.md) | Componentes e dados |
| [Operação](docs/OPERACAO.md) | Manual de uso |
| [Segurança](docs/SEGURANCA.md) | Controles e privacidade |
| [Implantação](docs/IMPLANTACAO.md) | Execução e infraestrutura |

## ⚖️ Uso responsável

O software é uma ferramenta de gestão e não substitui análise jurídica, contábil ou regulatória. Oferta de crédito, Pix, seguros e consultas externas dependem de parceiros autorizados. Consulte [LICENSE](LICENSE).

---

<div align="center">

**HelpSystemPro Crédito**  
Tecnologia para transformar controle em confiança.

</div>
