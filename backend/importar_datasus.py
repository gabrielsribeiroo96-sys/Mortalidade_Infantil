"""Gera o snapshot de dados reais de mortalidade infantil a partir do DATASUS.

Fontes (arquivos públicos, sem cadastro):
  - SIM (óbitos):          ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/DO{UF}{ANO}.dbc
  - SINASC (nascidos vivos): ftp.datasus.gov.br/dissemin/publicos/SINASC/1996_/Dados/DNRES/DN{UF}{ANO}.dbc
  - Coordenadas dos municípios: github.com/kelvins/municipios-brasileiros

Os arquivos são organizados por UF de residência. O script baixa cada arquivo
(com cache local), filtra os óbitos de menores de 1 ano, agrega por município
e por UF e salva tudo em `dados/datasus.json.gz`. Esse arquivo vai no
repositório: ao iniciar, o backend o carrega no MongoDB automaticamente
(e recarrega sempre que a versão do arquivo mudar).

Uso:
    python importar_datasus.py                      # 2018-2024, todas as UFs
    python importar_datasus.py --anos 2022 2023 --ufs SP RJ
    python importar_datasus.py --dry-run            # só processa, não salva
"""
import argparse
import csv
import gzip
import json
import struct
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import datasus_dbc

from data import CAUSE_LABELS, STATES, SNAPSHOT_PATH

ROOT_DIR = Path(__file__).parent
CACHE_DIR = ROOT_DIR / ".cache_datasus"

FTP_SIM = "ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/DO{uf}{ano}.dbc"
FTP_SINASC = "ftp://ftp.datasus.gov.br/dissemin/publicos/SINASC/1996_/Dados/DNRES/DN{uf}{ano}.dbc"
MUNICIPIOS_CSV = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"

UF_BY_SIGLA = {v[0]: code for code, v in STATES.items()}

# Capítulo da CID-10 (1ª letra da causa básica) -> grupo usado no dashboard
CAUSE_BY_LETTER = {
    "P": "perinatais", "Q": "malformacoes", "A": "infecciosas", "B": "infecciosas",
    "J": "respiratorias", "V": "externas", "W": "externas", "X": "externas",
    "Y": "externas", "E": "nutricionais", "R": "maldefinidas",
}

# Causas evitáveis em menores de 5 anos — APROXIMAÇÃO da "Lista Brasileira de
# Causas de Mortes Evitáveis por Intervenções do SUS" (Malta et al., 2007/2010),
# agrupando imunoprevenção, atenção à gestação/parto/recém-nascido, diagnóstico
# e tratamento adequados e promoção à saúde. Faixas de 3 caracteres (inclusivas)
# ou códigos de 4 caracteres. Conferir com a publicação antes de usar em análise.
EVITAVEIS_FAIXAS = [
    ("A00", "A09"), ("A15", "A41"), ("A42", "A99"), ("B00", "B09"), ("B15", "B99"),
    ("D50", "D53"), ("E10", "E14"), ("E40", "E64"), ("E86", "E86"),
    ("G00", "G03"), ("G40", "G41"), ("I00", "I09"),
    ("J00", "J22"), ("J40", "J47"), ("J68", "J69"), ("J85", "J86"), ("J90", "J94"), ("J98", "J98"),
    ("P00", "P96"), ("V01", "Y98"),
]
EVITAVEIS_EXCLUIDOS = {"P969"}  # afecção perinatal não especificada
EVITAVEIS_CODIGOS = {"N390"}


def eh_evitavel(cid):
    if not cid:
        return False
    cid = cid.strip().upper()
    if cid[:4] in EVITAVEIS_EXCLUIDOS:
        return False
    if cid[:4] in EVITAVEIS_CODIGOS:
        return True
    return any(ini <= cid[:3] <= fim for ini, fim in EVITAVEIS_FAIXAS)


def grupo_causa(cid):
    return CAUSE_BY_LETTER.get((cid or " ")[0].upper(), "outras")


def menor_de_1_ano(idade):
    # IDADE do SIM: 1º dígito = unidade (0 min, 1 h, 2 dias, 3 meses, 4 anos...)
    return bool(idade) and idade[0] in "0123"


def baixar(url, destino):
    if destino.exists():
        return destino
    print(f"  baixando {url}")
    tmp = destino.with_suffix(".part")
    with urllib.request.urlopen(url, timeout=300) as resp, open(tmp, "wb") as f:
        while chunk := resp.read(1 << 20):
            f.write(chunk)
    tmp.rename(destino)
    return destino


def ler_dbc(url, campos):
    """Baixa um .dbc do DATASUS e devolve só as colunas pedidas (gerador de dicts).

    Leitor DBF mínimo: lê o cabeçalho e fatia cada registro de largura fixa,
    muito mais rápido do que decodificar todas as ~80 colunas.
    """
    dbc = baixar(url, CACHE_DIR / url.rsplit("/", 1)[1])
    dbf = dbc.with_suffix(".dbf")
    if not dbf.exists():
        datasus_dbc.decompress(str(dbc), str(dbf))
    with open(dbf, "rb") as f:
        _, _, _, _, n_reg, tam_cab, tam_reg = struct.unpack("<BBBBIHH", f.read(12))
        f.seek(32)
        offsets, pos = {}, 1  # byte 0 de cada registro = flag de exclusão
        while (desc := f.read(32))[0] != 0x0D:
            nome = desc[:11].split(b"\0")[0].decode("ascii")
            tam = desc[16]
            offsets[nome] = (pos, pos + tam)
            pos += tam
        faltando = [c for c in campos if c not in offsets]
        if faltando:
            raise ValueError(f"{url}: colunas ausentes {faltando}")
        f.seek(tam_cab)
        for _ in range(n_reg):
            reg = f.read(tam_reg)
            if len(reg) < tam_reg:
                break
            if reg[0:1] == b"*":
                continue
            yield {c: reg[a:b].decode("latin-1").strip() for c, (a, b) in
                   ((c, offsets[c]) for c in campos)}


def carregar_municipios():
    destino = CACHE_DIR / "municipios.csv"
    baixar(MUNICIPIOS_CSV, destino)
    muns = {}
    with open(destino, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            muns[row["codigo_ibge"][:6]] = {
                "code": row["codigo_ibge"], "name": row["nome"],
                "lat": round(float(row["latitude"]), 4),
                "lng": round(float(row["longitude"]), 4),
            }
    return muns


def novo_agregado():
    return {"obitos": 0, "nascidos_vivos": 0, "obitos_evitaveis": 0,
            "causes": {k: 0 for k in CAUSE_LABELS}}


def processar_uf(sigla, ano):
    """Retorna (agregado_uf, {cod_mun_6: agregado})."""
    uf_total = novo_agregado()
    por_mun = defaultdict(novo_agregado)

    for r in ler_dbc(FTP_SIM.format(uf=sigla, ano=ano), ["IDADE", "CODMUNRES", "CAUSABAS"]):
        if not menor_de_1_ano(r["IDADE"]):
            continue
        cid = r["CAUSABAS"]
        for agg in (uf_total, por_mun[r["CODMUNRES"][:6]]):
            agg["obitos"] += 1
            agg["causes"][grupo_causa(cid)] += 1
            if eh_evitavel(cid):
                agg["obitos_evitaveis"] += 1

    for r in ler_dbc(FTP_SINASC.format(uf=sigla, ano=ano), ["CODMUNRES"]):
        uf_total["nascidos_vivos"] += 1
        por_mun[r["CODMUNRES"][:6]]["nascidos_vivos"] += 1

    return uf_total, por_mun


def montar_registro(agg, level, uf_code, nome, codigo, ano, coord=None):
    sigla, uf_name, region = STATES[uf_code][:3]
    n = agg["nascidos_vivos"]
    rec = {
        "level": level, "uf_code": uf_code, "uf": sigla, "uf_name": uf_name,
        "region": region, "municipality_code": codigo, "municipality_name": nome,
        "year": ano, "obitos": agg["obitos"], "nascidos_vivos": n,
        "tmi": round(agg["obitos"] / n * 1000, 2) if n else 0,
        "obitos_evitaveis": agg["obitos_evitaveis"], "causes": agg["causes"],
    }
    if coord:
        rec["lat"], rec["lng"] = coord
    return rec


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--anos", nargs="+", type=int, default=list(range(2018, 2025)))
    parser.add_argument("--ufs", nargs="+", default=sorted(UF_BY_SIGLA),
                        help="siglas das UFs (padrão: todas)")
    parser.add_argument("--dry-run", action="store_true", help="não salva o snapshot")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

    CACHE_DIR.mkdir(exist_ok=True)
    municipios = carregar_municipios()
    registros = []

    for sigla in (s.upper() for s in args.ufs):
        uf_code = UF_BY_SIGLA[sigla]
        for ano in args.anos:
            print(f"{sigla} {ano}")
            uf_total, por_mun = processar_uf(sigla, ano)
            uf_rec = montar_registro(uf_total, "uf", uf_code, STATES[uf_code][1], uf_code, ano)
            registros.append(uf_rec)
            print(f"  óbitos <1 ano: {uf_rec['obitos']}  nascidos vivos: "
                  f"{uf_rec['nascidos_vivos']}  TMI: {uf_rec['tmi']}")
            for cod6, agg in por_mun.items():
                mun = municipios.get(cod6)
                # Municípios ignorados/inválidos ficam só no total da UF
                if not mun or not mun["code"].startswith(uf_code):
                    continue
                registros.append(montar_registro(agg, "mun", uf_code, mun["name"], mun["code"],
                                                 ano, (mun["lat"], mun["lng"])))

    print(f"\n{len(registros)} registros gerados.")
    if args.dry_run:
        return

    snapshot = {
        "meta": {
            "source": "datasus",
            # A versão muda a cada importação; o backend recarrega o banco quando ela muda
            "versao": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "anos": sorted(args.anos), "ufs": sorted(s.upper() for s in args.ufs),
        },
        "registros": registros,
    }
    SNAPSHOT_PATH.parent.mkdir(exist_ok=True)
    with gzip.open(SNAPSHOT_PATH, "wt", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, separators=(",", ":"))
    tamanho = SNAPSHOT_PATH.stat().st_size / 1e6
    print(f"Snapshot salvo em {SNAPSHOT_PATH.relative_to(ROOT_DIR)} ({tamanho:.1f} MB). "
          "Faça commit desse arquivo para publicar os dados.")

if __name__ == "__main__":
    sys.exit(main())
