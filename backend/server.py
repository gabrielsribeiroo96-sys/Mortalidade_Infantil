from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import gzip
import json
import logging
import re
import requests
from pathlib import Path
from typing import Optional

from data import build_records, CAUSE_LABELS, STATES, SNAPSHOT_PATH

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Build do React (gerado pelo Dockerfile). Se existir, o backend também serve o frontend.
STATIC_DIR = Path(os.environ.get('STATIC_DIR', ROOT_DIR / 'static'))

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Observatório de Mortalidade Infantil")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECTION = {"_id": 0}


async def replace_mortality(records, fonte):
    """Troca os dados de uma vez (coleção temporária + rename): a API nunca vê dados pela metade."""
    await db.mortality_import.drop()
    await db.mortality_import.insert_many(records)
    await db.mortality_import.rename("mortality", dropTarget=True)
    await db.mortality.create_index([("level", 1), ("uf", 1), ("year", 1)])
    await db.metadata.replace_one({"_id": "fonte"}, {"_id": "fonte", **fonte}, upsert=True)


@app.on_event("startup")
async def seed_data():
    fonte = await db.metadata.find_one({"_id": "fonte"}) or {}

    if SNAPSHOT_PATH.exists():
        with gzip.open(SNAPSHOT_PATH, "rt", encoding="utf-8") as f:
            snapshot = json.load(f)
        if fonte.get("versao") == snapshot["meta"]["versao"]:
            logger.info(f"DATASUS data up to date (versao {fonte['versao']})")
            return
        await replace_mortality(snapshot["registros"], snapshot["meta"])
        logger.info(f"Loaded {len(snapshot['registros'])} DATASUS records "
                    f"(versao {snapshot['meta']['versao']})")
        return

    # Sem snapshot: usa o dataset de demonstração se o banco estiver vazio
    if await db.mortality.count_documents({}):
        logger.info("Mortality collection already populated")
        return
    if os.environ.get('SEED_DEMO_DATA', 'true').lower() == 'false':
        logger.warning("Mortality collection is empty and no snapshot was found")
        return
    records = build_records()
    await replace_mortality(records, {"source": "demo"})
    logger.info(f"Seeded {len(records)} demo mortality records")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@api_router.get("/")
async def root():
    return {"message": "Observatório de Mortalidade Infantil API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


@api_router.get("/meta")
async def meta():
    """Metadados para os filtros: estados, anos e causas (CID-10)."""
    states = [
        {"code": code, "uf": v[0], "name": v[1], "region": v[2]}
        for code, v in STATES.items()
    ]
    states.sort(key=lambda s: s["name"])
    years = sorted(await db.mortality.distinct("year"))
    causes = [{"key": k, "label": label} for k, label in CAUSE_LABELS.items()]
    regions = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]
    fonte = await db.metadata.find_one({"_id": "fonte"}) or {"source": "demo"}
    fonte.pop("_id", None)
    return {"states": states, "years": years, "causes": causes, "regions": regions,
            "source": fonte}


def _build_query(year, uf, level):
    q = {}
    if level:
        q["level"] = level
    if year:
        q["year"] = int(year)
    if uf:
        q["uf"] = uf
    return q


@api_router.get("/records")
async def get_records(
    year: Optional[int] = None,
    uf: Optional[str] = None,
    search: Optional[str] = None,
    all_years: bool = False,
):
    """Retorna linhas para a tabela.

    Sem UF -> agregados por estado (level=uf).
    Com UF -> municípios daquele estado (level=mun).
    all_years=True ignora o filtro de ano (mostra a série completa).
    """
    level = "mun" if uf else "uf"
    q = _build_query(None if all_years else year, uf, level)
    if search:
        q["municipality_name"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.mortality.find(q, PROJECTION).to_list(20000)
    if all_years:
        docs.sort(key=lambda d: (d["municipality_name"], d["year"]))
    else:
        docs.sort(key=lambda d: d["tmi"], reverse=True)
    return docs


@api_router.get("/map")
async def get_map(year: Optional[int] = None):
    """Dados por estado para o choropleth (chave = sigla UF)."""
    q = {"level": "uf"}
    if year:
        q["year"] = int(year)
    docs = await db.mortality.find(q, PROJECTION).to_list(2000)
    return {d["uf"]: {
        "uf": d["uf"], "uf_name": d["uf_name"], "region": d["region"],
        "tmi": d["tmi"], "obitos": d["obitos"],
        "nascidos_vivos": d["nascidos_vivos"], "obitos_evitaveis": d["obitos_evitaveis"],
    } for d in docs}


@api_router.get("/summary")
async def get_summary(year: Optional[int] = None, uf: Optional[str] = None):
    """KPIs agregados (nível estadual para evitar dupla contagem)."""
    q = {"level": "uf"}
    if year:
        q["year"] = int(year)
    if uf:
        q["uf"] = uf
    docs = await db.mortality.find(q, PROJECTION).to_list(2000)
    if not docs:
        return {"tmi": 0, "obitos": 0, "nascidos_vivos": 0, "obitos_evitaveis": 0,
                "pct_evitaveis": 0, "num_unidades": 0}
    obitos = sum(d["obitos"] for d in docs)
    nascidos = sum(d["nascidos_vivos"] for d in docs)
    evitaveis = sum(d["obitos_evitaveis"] for d in docs)
    tmi = round(obitos / nascidos * 1000, 2) if nascidos else 0
    pct_evit = round(evitaveis / obitos * 100, 1) if obitos else 0
    return {
        "tmi": tmi, "obitos": obitos, "nascidos_vivos": nascidos,
        "obitos_evitaveis": evitaveis, "pct_evitaveis": pct_evit,
        "num_unidades": len(docs),
    }


@api_router.get("/trends")
async def get_trends(uf: Optional[str] = None):
    """Série histórica da TMI (por ano)."""
    q = {"level": "uf"}
    if uf:
        q["uf"] = uf
    docs = await db.mortality.find(q, PROJECTION).to_list(5000)
    by_year = {}
    for d in docs:
        y = d["year"]
        by_year.setdefault(y, {"obitos": 0, "nascidos": 0})
        by_year[y]["obitos"] += d["obitos"]
        by_year[y]["nascidos"] += d["nascidos_vivos"]
    out = []
    for y in sorted(by_year):
        o, n = by_year[y]["obitos"], by_year[y]["nascidos"]
        out.append({"year": y, "tmi": round(o / n * 1000, 2) if n else 0,
                    "obitos": o, "nascidos_vivos": n})
    return out


@api_router.get("/causes")
async def get_causes(year: Optional[int] = None, uf: Optional[str] = None):
    """Distribuição por capítulo da CID-10."""
    q = {"level": "uf"}
    if year:
        q["year"] = int(year)
    if uf:
        q["uf"] = uf
    docs = await db.mortality.find(q, PROJECTION).to_list(2000)
    totals = {k: 0 for k in CAUSE_LABELS}
    for d in docs:
        for k, v in d.get("causes", {}).items():
            totals[k] = totals.get(k, 0) + v
    return [{"key": k, "label": CAUSE_LABELS[k], "value": totals[k]} for k in CAUSE_LABELS]


@api_router.get("/regions")
async def get_regions(year: Optional[int] = None):
    """Comparativo regional da TMI."""
    q = {"level": "uf"}
    if year:
        q["year"] = int(year)
    docs = await db.mortality.find(q, PROJECTION).to_list(2000)
    by_reg = {}
    for d in docs:
        r = d["region"]
        by_reg.setdefault(r, {"obitos": 0, "nascidos": 0})
        by_reg[r]["obitos"] += d["obitos"]
        by_reg[r]["nascidos"] += d["nascidos_vivos"]
    order = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]
    return [{"region": r, "tmi": round(by_reg[r]["obitos"] / by_reg[r]["nascidos"] * 1000, 2)
             if by_reg.get(r, {}).get("nascidos") else 0,
             "obitos": by_reg.get(r, {}).get("obitos", 0)}
            for r in order if r in by_reg]


@api_router.get("/export")
async def export_csv(year: Optional[int] = None, uf: Optional[str] = None):
    """Exporta os dados filtrados em CSV (para pesquisadores)."""
    level = "mun" if uf else "uf"
    q = _build_query(year, uf, level)
    docs = await db.mortality.find(q, PROJECTION).to_list(20000)
    docs.sort(key=lambda d: (d["uf"], d["municipality_name"], d["year"]))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["codigo_ibge", "municipio", "uf", "regiao", "ano",
                     "obitos_menores_1ano", "nascidos_vivos", "tmi_por_mil",
                     "obitos_evitaveis"])
    for d in docs:
        writer.writerow([d["municipality_code"], d["municipality_name"], d["uf"],
                         d["region"], d["year"], d["obitos"], d["nascidos_vivos"],
                         d["tmi"], d["obitos_evitaveis"]])
    buf.seek(0)
    fname = f"mortalidade_infantil_{uf or 'brasil'}_{year or 'todos'}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.get("/export/detailed")
async def export_detailed_csv(uf: Optional[str] = None):
    """Export detalhado em formato longo (tidy): uma linha por local x ano x causa.

    Inclui TODOS os anos e TODAS as causas (CID-10), ideal para análise em
    planilha (tabela dinâmica/pivot). Respeita apenas o filtro de UF.
    """
    level = "mun" if uf else "uf"
    q = {"level": level}
    if uf:
        q["uf"] = uf
    docs = await db.mortality.find(q, PROJECTION).to_list(100000)
    docs.sort(key=lambda d: (d["uf"], d["municipality_name"], d["year"]))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "nivel", "codigo_ibge", "municipio", "uf", "uf_nome", "regiao", "ano",
        "capitulo_cid10", "obitos_por_causa", "obitos_total_ano",
        "nascidos_vivos", "tmi_por_mil", "obitos_evitaveis",
    ])
    for d in docs:
        nivel = "Estado" if d["level"] == "uf" else "Municipio"
        causes = d.get("causes", {})
        for key, label in CAUSE_LABELS.items():
            writer.writerow([
                nivel, d["municipality_code"], d["municipality_name"], d["uf"],
                d["uf_name"], d["region"], d["year"], label, causes.get(key, 0),
                d["obitos"], d["nascidos_vivos"], d["tmi"], d["obitos_evitaveis"],
            ])
    buf.seek(0)
    fname = f"mortalidade_infantil_detalhado_{uf or 'brasil'}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


# ---- Integrações com APIs públicas gratuitas (IBGE / ViaCEP) ----

@api_router.get("/ibge/municipios/{uf}")
def ibge_municipios(uf: str):
    """Lista municípios de uma UF via API oficial do IBGE."""
    try:
        resp = requests.get(
            f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios",
            timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return [{"id": m["id"], "nome": m["nome"]} for m in data]
    except Exception as e:
        logger.error(f"IBGE error: {e}")
        raise HTTPException(status_code=502, detail="Falha ao consultar a API do IBGE")


@api_router.get("/cep/{cep}")
def busca_cep(cep: str):
    """Busca endereço/município por CEP via ViaCEP (gratuito, sem chave)."""
    cep_clean = "".join(ch for ch in cep if ch.isdigit())
    if len(cep_clean) != 8:
        raise HTTPException(status_code=400, detail="CEP inválido (8 dígitos)")
    try:
        resp = requests.get(f"https://viacep.com.br/ws/{cep_clean}/json/", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("erro"):
            raise HTTPException(status_code=404, detail="CEP não encontrado")
        return {
            "cep": data.get("cep"), "logradouro": data.get("logradouro"),
            "bairro": data.get("bairro"), "localidade": data.get("localidade"),
            "uf": data.get("uf"), "ibge": data.get("ibge"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ViaCEP error: {e}")
        raise HTTPException(status_code=502, detail="Falha ao consultar o ViaCEP")


app.include_router(api_router)

# Comprime respostas grandes (GeoJSON do mapa, JSON da API, CSVs)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS só é necessário quando o frontend roda em outro domínio (ex.: `yarn start` local)
cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )


if STATIC_DIR.is_dir():
    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        """Serve o build do React; rotas desconhecidas caem no index.html (SPA)."""
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file = (STATIC_DIR / path).resolve()
        if path and file.is_file() and file.is_relative_to(STATIC_DIR.resolve()):
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
