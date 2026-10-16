"""Gerador de dataset representativo de mortalidade infantil (SIM/SINASC).

Os números são sintéticos porém realistas (baseados em ordens de grandeza
oficiais do DATASUS) e servem só para demonstração. Para carregar os dados
reais do SIM/SINASC use o script `importar_datasus.py`.
"""
import random
from pathlib import Path

random.seed(42)

# Dados reais agregados, gerados por importar_datasus.py
SNAPSHOT_PATH = Path(__file__).parent / "dados" / "datasus.json.gz"

# Capítulos da CID-10 mais relevantes para óbitos infantis (< 1 ano)
CAUSE_GROUPS = [
    ("perinatais", "Afecções perinatais (P00-P96)", 0.55),
    ("malformacoes", "Malformações congênitas (Q00-Q99)", 0.22),
    ("infecciosas", "Doenças infecciosas e parasitárias (A00-B99)", 0.06),
    ("respiratorias", "Doenças do aparelho respiratório (J00-J99)", 0.04),
    ("externas", "Causas externas (V01-Y98)", 0.02),
    ("nutricionais", "Endócrinas/metabólicas/nutricionais (E00-E90)", 0.05),
    ("maldefinidas", "Sintomas e sinais mal definidos (R00-R99)", 0.04),
    ("outras", "Demais causas", 0.02),
]

# code: (sigla, nome, regiao, capital_ibge, capital_nome, nascidos_uf_base, tmi_base)
STATES = {
    "11": ("RO", "Rondônia", "Norte", "1100205", "Porto Velho", 25000, 15.5),
    "12": ("AC", "Acre", "Norte", "1200401", "Rio Branco", 18000, 17.0),
    "13": ("AM", "Amazonas", "Norte", "1302603", "Manaus", 80000, 16.5),
    "14": ("RR", "Roraima", "Norte", "1400100", "Boa Vista", 12000, 16.0),
    "15": ("PA", "Pará", "Norte", "1501402", "Belém", 140000, 17.5),
    "16": ("AP", "Amapá", "Norte", "1600303", "Macapá", 15000, 18.0),
    "17": ("TO", "Tocantins", "Norte", "1721000", "Palmas", 22000, 14.5),
    "21": ("MA", "Maranhão", "Nordeste", "2111300", "São Luís", 110000, 16.0),
    "22": ("PI", "Piauí", "Nordeste", "2211001", "Teresina", 45000, 15.5),
    "23": ("CE", "Ceará", "Nordeste", "2304400", "Fortaleza", 120000, 13.5),
    "24": ("RN", "Rio Grande do Norte", "Nordeste", "2408102", "Natal", 45000, 14.0),
    "25": ("PB", "Paraíba", "Nordeste", "2507507", "João Pessoa", 55000, 14.5),
    "26": ("PE", "Pernambuco", "Nordeste", "2611606", "Recife", 120000, 14.0),
    "27": ("AL", "Alagoas", "Nordeste", "2704302", "Maceió", 45000, 15.5),
    "28": ("SE", "Sergipe", "Nordeste", "2800308", "Aracaju", 30000, 15.0),
    "29": ("BA", "Bahia", "Nordeste", "2927408", "Salvador", 190000, 14.5),
    "31": ("MG", "Minas Gerais", "Sudeste", "3106200", "Belo Horizonte", 240000, 10.5),
    "32": ("ES", "Espírito Santo", "Sudeste", "3205309", "Vitória", 50000, 10.0),
    "33": ("RJ", "Rio de Janeiro", "Sudeste", "3304557", "Rio de Janeiro", 200000, 11.5),
    "35": ("SP", "São Paulo", "Sudeste", "3550308", "São Paulo", 600000, 10.0),
    "41": ("PR", "Paraná", "Sul", "4106902", "Curitiba", 140000, 9.8),
    "42": ("SC", "Santa Catarina", "Sul", "4205407", "Florianópolis", 90000, 9.2),
    "43": ("RS", "Rio Grande do Sul", "Sul", "4314902", "Porto Alegre", 130000, 9.5),
    "50": ("MS", "Mato Grosso do Sul", "Centro-Oeste", "5002704", "Campo Grande", 40000, 12.5),
    "51": ("MT", "Mato Grosso", "Centro-Oeste", "5103403", "Cuiabá", 55000, 13.0),
    "52": ("GO", "Goiás", "Centro-Oeste", "5208707", "Goiânia", 90000, 12.0),
    "53": ("DF", "Distrito Federal", "Centro-Oeste", "5300108", "Brasília", 45000, 11.0),
}

# Municípios extras (além das capitais) para dar mais densidade à visão municipal
EXTRA_MUNICIPALITIES = {
    "35": [("3509502", "Campinas", 18000), ("3518800", "Guarulhos", 20000), ("3543402", "Ribeirão Preto", 9000)],
    "33": [("3303302", "São Gonçalo", 12000), ("3301702", "Duque de Caxias", 13000)],
    "31": [("3170206", "Uberlândia", 9000), ("3106705", "Betim", 6000)],
    "29": [("2910800", "Feira de Santana", 10000), ("2918407", "Itabuna", 4000)],
    "23": [("2307650", "Juazeiro do Norte", 4500), ("2304285", "Caucaia", 6000)],
    "26": [("2607901", "Jaboatão dos Guararapes", 12000), ("2609600", "Olinda", 6000)],
    "41": [("4113700", "Londrina", 7000), ("4115200", "Maringá", 5000)],
    "43": [("4305108", "Caxias do Sul", 6000), ("4314407", "Pelotas", 4500)],
    "42": [("4209102", "Joinville", 8000), ("4202404", "Blumenau", 5000)],
    "52": [("5201405", "Aparecida de Goiânia", 7000), ("5201108", "Anápolis", 5000)],
    "15": [("1500800", "Ananindeua", 8000), ("1506807", "Santarém", 5000)],
    "21": [("2105302", "Imperatriz", 5000)],
    "24": [("2408003", "Mossoró", 5000)],
    "25": [("2504009", "Campina Grande", 6000)],
}

# Coordenadas [lat, lng] dos municípios (para os pontos no mapa)
COORDS = {
    "1100205": [-8.76, -63.90], "1200401": [-9.97, -67.81], "1302603": [-3.12, -60.02],
    "1400100": [2.82, -60.67], "1501402": [-1.46, -48.50], "1600303": [0.03, -51.07],
    "1721000": [-10.18, -48.33], "2111300": [-2.53, -44.30], "2211001": [-5.09, -42.80],
    "2304400": [-3.73, -38.52], "2408102": [-5.79, -35.21], "2507507": [-7.12, -34.86],
    "2611606": [-8.05, -34.88], "2704302": [-9.65, -35.73], "2800308": [-10.91, -37.07],
    "2927408": [-12.97, -38.51], "3106200": [-19.92, -43.94], "3205309": [-20.32, -40.34],
    "3304557": [-22.91, -43.20], "3550308": [-23.55, -46.63], "4106902": [-25.43, -49.27],
    "4205407": [-27.59, -48.55], "4314902": [-30.03, -51.23], "5002704": [-20.47, -54.62],
    "5103403": [-15.60, -56.10], "5208707": [-16.69, -49.26], "5300108": [-15.79, -47.88],
    "3509502": [-22.91, -47.06], "3518800": [-23.45, -46.53], "3543402": [-21.18, -47.81],
    "3303302": [-22.83, -43.05], "3301702": [-22.79, -43.31], "3170206": [-18.92, -48.28],
    "3106705": [-19.97, -44.20], "2910800": [-12.27, -38.97], "2918407": [-14.79, -39.28],
    "2307650": [-7.21, -39.32], "2304285": [-3.74, -38.65], "2607901": [-8.11, -35.01],
    "2609600": [-8.01, -34.86], "4113700": [-23.31, -51.16], "4115200": [-23.42, -51.94],
    "4305108": [-29.17, -51.18], "4314407": [-31.77, -52.34], "4209102": [-26.30, -48.85],
    "4202404": [-26.92, -49.07], "5201405": [-16.82, -49.24], "5201108": [-16.33, -48.95],
    "1500800": [-1.37, -48.37], "1506807": [-2.44, -54.71], "2105302": [-5.53, -47.49],
    "2408003": [-5.19, -37.34], "2504009": [-7.23, -35.88],
}

YEARS = list(range(2018, 2025))


def _cause_counts(obitos):
    counts = {}
    remaining = obitos
    for i, (key, _, frac) in enumerate(CAUSE_GROUPS):
        if i == len(CAUSE_GROUPS) - 1:
            counts[key] = max(remaining, 0)
        else:
            c = int(round(obitos * frac))
            counts[key] = c
            remaining -= c
    return counts


def _year_factor(year):
    # leve tendência de queda ao longo dos anos + ruído
    base = 1.0 - (year - 2018) * 0.012
    return base * random.uniform(0.97, 1.03)


def build_records():
    records = []
    for code, (sigla, nome, regiao, cap_ibge, cap_nome, nasc_base, tmi_base) in STATES.items():
        for year in YEARS:
            yf = _year_factor(year)
            nascidos = int(nasc_base * random.uniform(0.96, 1.04))
            tmi = round(tmi_base * yf, 2)
            obitos = int(round(nascidos * tmi / 1000.0))
            evitaveis = int(round(obitos * random.uniform(0.55, 0.68)))
            causes = _cause_counts(obitos)
            records.append({
                "level": "uf",
                "uf_code": code,
                "uf": sigla,
                "uf_name": nome,
                "region": regiao,
                "municipality_code": code,
                "municipality_name": nome,
                "year": year,
                "obitos": obitos,
                "nascidos_vivos": nascidos,
                "tmi": round(obitos / nascidos * 1000, 2),
                "obitos_evitaveis": evitaveis,
                "causes": causes,
            })

        # Municípios: capital + extras
        muns = [(cap_ibge, cap_nome, int(nasc_base * 0.28))]
        muns += EXTRA_MUNICIPALITIES.get(code, [])
        for mun_code, mun_name, mun_nasc_base in muns:
            for year in YEARS:
                yf = _year_factor(year)
                nascidos = int(mun_nasc_base * random.uniform(0.95, 1.05))
                tmi = round(tmi_base * random.uniform(0.85, 1.1) * yf, 2)
                obitos = int(round(nascidos * tmi / 1000.0))
                evitaveis = int(round(obitos * random.uniform(0.55, 0.68)))
                causes = _cause_counts(obitos)
                coord = COORDS.get(mun_code, [None, None])
                records.append({
                    "level": "mun",
                    "uf_code": code,
                    "uf": sigla,
                    "uf_name": nome,
                    "region": regiao,
                    "municipality_code": mun_code,
                    "municipality_name": mun_name,
                    "year": year,
                    "obitos": obitos,
                    "nascidos_vivos": nascidos,
                    "tmi": round(obitos / nascidos * 1000, 2),
                    "obitos_evitaveis": evitaveis,
                    "causes": causes,
                    "lat": coord[0],
                    "lng": coord[1],
                })
    return records


CAUSE_LABELS = {k: label for k, label, _ in CAUSE_GROUPS}
