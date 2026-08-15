# Regras de Negócio

## Conceitos

- **Principal:** capital efetivamente emprestado e ainda não amortizado.
- **Juros do ciclo:** remuneração calculada sobre o principal conforme taxa e período contratados.
- **Multa:** encargo de atraso separado dos juros.
- **Pagamento:** entrada financeira confirmada e distribuída por finalidade.
- **Ciclo:** período de cobrança, inicialmente configurado em 30 dias corridos.
- **Renovação:** continuidade do principal após pagamento dos juros do ciclo.
- **Renegociação:** encerramento controlado do contrato anterior e criação de novas condições.

## Somente juros

1. Conferir o valor recebido.
2. Aplicá-lo aos juros pendentes.
3. Preservar o principal.
4. Encerrar o ciclo atual como pago.
5. Criar novo ciclo de 30 dias.
6. Manter vínculo entre os ciclos.
7. Emitir comprovante.

Se o pagamento não cobrir todos os juros, o sistema não deve classificá-lo automaticamente como “juros pagos”.

## Pagamento parcial

A distribuição padrão sugerida é:

1. multa vencida;
2. juros vencidos;
3. juros do ciclo;
4. principal.

Essa ordem deve ser configurável e sempre apresentada antes da confirmação.

## Renegociação

Uma renegociação nunca sobrescreve o contrato anterior.

- registra o pagamento realizado;
- calcula o saldo de composição;
- encerra o contrato anterior como renegociado;
- cria novo contrato ou acordo;
- registra origem, destino, usuário, data e justificativa;
- gera novos documentos e avisos.

## Quitação

O status “Quitado” somente pode ser aplicado quando o saldo contábil for zero ou quando existir ajuste autorizado, justificado e auditado. Data, valor e comprovante devem permanecer vinculados.

## Comprovantes

- comprovante enviado: evidência aguardando validação;
- pagamento confirmado: lançamento financeiro aprovado ou conciliado;
- recibo emitido: documento gerado pelo sistema após confirmação;
- estorno: novo evento compensatório, nunca exclusão silenciosa.

## Datas

O sistema deve distinguir:

- dia 15 ajustado para dia útil;
- quinto dia útil;
- último dia do mês;
- prazo de 30 dias corridos.

Essas regras não podem compartilhar nomes ambíguos.

## Status iniciais

- Rascunho
- Em aberto
- Vence em breve
- Vencido
- Parcialmente pago
- Juros pagos — renovado
- Renegociado
- Quitado
- Cancelado

