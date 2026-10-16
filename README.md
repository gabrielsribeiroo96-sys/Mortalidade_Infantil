# Observatório de Mortalidade Infantil

Painel web para consultar a mortalidade infantil (óbitos de menores de 1 ano) no Brasil por estado, município e ano, com dados abertos do DATASUS. Projeto Integrador UNIVESP.

- **Frontend:** React, Tailwind e Leaflet (mapa) com Recharts (gráficos)
- **Backend:** FastAPI (Python)
- **Banco:** MongoDB
- **APIs públicas:** IBGE (municípios) e ViaCEP (busca por CEP)

## Fontes de dados

| Dado | Fonte | Como entra no sistema |
|---|---|---|
| Óbitos de menores de 1 ano | SIM, DATASUS (`DORES/DO{UF}{ANO}.dbc`) | `backend/importar_datasus.py` |
| Nascidos vivos | SINASC, DATASUS (`DNRES/DN{UF}{ANO}.dbc`) | `backend/importar_datasus.py` |
| Coordenadas dos municípios | [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) | `backend/importar_datasus.py` |
| Municípios por UF | API do IBGE | ao vivo (`/api/ibge/municipios/{uf}`) |
| CEP | ViaCEP | ao vivo (`/api/cep/{cep}`) |

O SIM e o SINASC não têm API em tempo real: são publicados como arquivos no FTP do DATASUS. O importador baixa esses arquivos, filtra os óbitos de menores de 1 ano, agrega por município de residência e salva o resultado em `backend/dados/datasus.json.gz`. Esse arquivo fica no repositório. Ao iniciar, o backend o carrega no MongoDB automaticamente, e de novo sempre que a versão do arquivo mudar.

**Indicadores**
- **TMI** = óbitos de menores de 1 ano ÷ nascidos vivos × 1000.
- **Causas** agrupadas pelo capítulo da CID-10 da causa básica.
- **Óbitos evitáveis**: aproximação da *Lista Brasileira de Causas de Mortes Evitáveis* (Malta et al.). Veja `EVITAVEIS_FAIXAS` em `backend/importar_datasus.py`.

Sem o arquivo de dados, o backend usa um **conjunto de demonstração** (`backend/data.py`, valores sintéticos). O aviso no topo do painel indica qual das duas fontes está em uso.

## Rodando localmente

### Opção 1: Docker (mais simples)

```bash
docker compose up --build
# abra http://localhost:8000
```

Se alguma porta estiver ocupada: `APP_PORT=8091 MONGO_PORT=27018 docker compose up --build`.

### Opção 2: Sem Docker

Pré-requisitos: Python 3.11+, Node 20+ e um MongoDB (local ou Atlas).

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                # ajuste MONGO_URL
uvicorn server:app --reload --port 8001

# Frontend (outro terminal)
cd frontend
corepack enable
yarn install
cp .env.example .env
yarn start                                          # http://localhost:3000
```

## Atualizando os dados do DATASUS

Só é preciso fazer isso quando o DATASUS publicar um ano novo:

```bash
cd backend
pip install -r requirements-dev.txt
python importar_datasus.py --anos 2018 2019 2020 2021 2022 2023 2024 2025
git add dados/datasus.json.gz && git commit -m "Atualiza dados do DATASUS"
git push        # o Render faz o deploy e o backend recarrega o banco sozinho
```

Os downloads ficam em cache em `backend/.cache_datasus/`. Uma importação completa do zero baixa cerca de 380 arquivos. Use `--ufs SP RJ` para um recorte e `--dry-run` para processar sem salvar.

## Testes

Os testes são de integração e rodam contra um backend no ar:

```bash
cd backend
API_BASE_URL=http://localhost:8000 pytest tests
```

## Deploy (Render + MongoDB Atlas, gratuito)

O `Dockerfile` gera uma única imagem: o FastAPI serve a API em `/api` e o build do React no restante das rotas. Por isso não é preciso configurar CORS nem duas URLs.

1. **MongoDB Atlas:** crie um cluster gratuito (M0) em <https://cloud.mongodb.com>.
   - Crie um usuário de banco.
   - Em *Network Access*, libere `0.0.0.0/0`, porque o plano grátis do Render não tem IP fixo.
   - Copie a string de conexão (`mongodb+srv://...`).
2. **Render:** em <https://render.com>, vá em *New → Blueprint*, escolha este repositório e informe `MONGO_URL` quando pedido. O `render.yaml` cuida do resto.
3. Na primeira inicialização, o backend carrega os dados do DATASUS no Atlas sozinho.
4. A cada push na branch `main`, o Render faz o deploy de novo automaticamente.

No plano gratuito do Render, o serviço "dorme" após 15 minutos sem acesso. O primeiro acesso depois disso leva cerca de 1 minuto. Antes de uma apresentação, abra o site um pouco antes.

Qualquer servidor com Docker também funciona (VPS, Railway, Fly.io…): basta construir a imagem e definir `MONGO_URL` e `DB_NAME`.

### Variáveis de ambiente do backend

| Variável | Padrão | Descrição |
|---|---|---|
| `MONGO_URL` | — | string de conexão do MongoDB (obrigatória) |
| `DB_NAME` | — | nome do banco (obrigatória) |
| `SEED_DEMO_DATA` | `true` | sem o arquivo de dados e com o banco vazio, carrega a demonstração |
| `CORS_ORIGINS` | vazio | origens liberadas, separadas por vírgula (só para dev com `yarn start`) |
| `PORT` | `8000` | porta HTTP (o Render define automaticamente) |
