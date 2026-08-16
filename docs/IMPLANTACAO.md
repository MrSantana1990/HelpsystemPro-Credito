# Implantação

## Modelo suportado

A versão atual deve rodar em **uma única instância**, porque usa SQLite. Ela pode ser instalada:

- no computador Windows para uso local;
- em um servidor Linux com Docker;
- em uma máquina virtual privada atrás de proxy HTTPS.

Não execute duas réplicas apontando para o mesmo banco.

## Produção com Docker

### Requisitos

- servidor Linux atualizado;
- Docker Engine com Compose;
- domínio ou subdomínio;
- proxy reverso com certificado TLS;
- armazenamento persistente;
- rotina externa de backup;
- monitoramento básico.

### Variáveis obrigatórias

```env
COOKIE_SECURE=true
TRUST_PROXY=true
APP_ORIGIN=https://credito.seudominio.com.br
```

### Subir

```bash
docker compose build
docker compose up -d
docker compose ps
```

O Compose publica a aplicação somente em `127.0.0.1:8091`. O proxy reverso recebe HTTPS e encaminha internamente.

## Volumes

- `helpsystem_data`: banco operacional.
- `./backups`: cópias verificadas do banco.

O volume do banco e a pasta de backup precisam participar da política de cópias externas.

## Atualização

1. Criar backup.
2. Baixar a versão aprovada.
3. Construir a nova imagem.
4. Reiniciar uma única instância.
5. Conferir `/api/status`.
6. Validar login e Dashboard.

## Rollback

1. Parar o container.
2. Restaurar o backup pelo script ou volume de recuperação.
3. Subir a versão anterior da imagem.
4. Verificar a integridade e os totais.

## Não fazer

- não expor `0.0.0.0:8091` sem proxy e firewall;
- não colocar o banco dentro da imagem;
- não usar armazenamento efêmero;
- não manter somente backups no mesmo servidor;
- não configurar múltiplas réplicas com SQLite.

