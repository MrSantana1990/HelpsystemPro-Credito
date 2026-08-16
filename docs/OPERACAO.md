# Manual de Operação

## Primeiro acesso

1. Execute `INICIAR_PROTOTIPO.bat` — o nome será mantido por compatibilidade.
2. Cadastre o nome, e-mail e uma senha com pelo menos 10 caracteres.
3. Guarde a senha em um gerenciador de senhas.
4. Crie um backup após concluir a configuração.

## Ordem recomendada

1. Cadastrar o cliente.
2. Criar o contrato e conferir principal, taxa, prazo e vencimento.
3. Registrar cada pagamento somente após confirmar o recebimento.
4. Emitir o recibo pelo histórico do contrato.
5. Criar backup ao final do dia com movimentações.

## Pagamento

O valor recebido é aplicado nesta ordem:

1. multa pendente;
2. juros pendentes;
3. principal.

O sistema mostra separadamente quanto foi destinado a cada parte. Excedentes não são absorvidos silenciosamente.

## Renovação

Marque “Renovar por mais 30 dias” somente quando o pagamento quitar exatamente multa e juros pendentes. O principal permanece e um novo ciclo vinculado é criado.

## Renegociação

A renegociação:

- quita primeiro multa e juros pendentes;
- aplica eventual restante no principal;
- encerra o contrato anterior;
- cria outro contrato vinculado;
- exige uma justificativa.

Se o valor recebido zerar o principal, registre quitação em vez de renegociação.

## Importação da planilha

1. Faça backup do banco.
2. Abra “Importar planilha”.
3. Informe o cliente associado aos registros.
4. Selecione o arquivo `.xlsx`.
5. Leia a pré-visualização e os avisos.
6. Confirme somente se os totais coincidirem.
7. Resolva a fila “Revisar importação”.

O mesmo arquivo não pode ser importado duas vezes. A linha original é preservada em formato bruto para auditoria.

## Recibos

No histórico do contrato, escolha “Emitir recibo”. O documento contém composição do pagamento e código de validação. Use a impressão do navegador para salvar em PDF.

## Backup

- Pela interface: botão “Criar backup”.
- Pelo Windows: `CRIAR_BACKUP.bat`.
- Destino: pasta `backups`.

Mantenha uma cópia fora do computador, preferencialmente criptografada.

## Restauração

1. Feche o sistema.
2. Confirme que o arquivo está dentro da pasta `backups`.
3. Arraste o `.db` sobre `RESTAURAR_BACKUP.bat`.
4. Aguarde a verificação de integridade.
5. Inicie o sistema e confira clientes, contratos e totais.

A restauração preserva uma cópia automática da base anterior.

## O que nunca fazer

- não editar o arquivo `.db` manualmente;
- não apagar as pastas `data` ou `backups`;
- não compartilhar senha por WhatsApp;
- não registrar pagamento antes de confirmar o dinheiro;
- não importar a mesma base com nomes diferentes;
- não expor a porta 8091 diretamente à internet.

