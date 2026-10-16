"""Testes da API do Observatório de Mortalidade Infantil."""
import os
import pytest
import requests

# Testes de integração: rodam contra um backend no ar (padrão: localhost:8001)
BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Health / Meta ----
def test_health(s):
    r = s.get(f"{API}/health", timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_meta(s):
    r = s.get(f"{API}/meta", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data["states"]) == 27
    assert set(data["years"]) >= set(range(2018, 2025))
    assert len(data["causes"]) == 8


# ---- Summary ----
def test_summary_2024(s):
    r = s.get(f"{API}/summary", params={"year": 2024}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["tmi", "obitos", "nascidos_vivos", "pct_evitaveis"]:
        assert d[k] > 0, f"{k} should be > 0"


# ---- Map ----
def test_map_2024(s):
    r = s.get(f"{API}/map", params={"year": 2024}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert len(d) == 27
    for uf, row in d.items():
        assert "tmi" in row and "obitos" in row and "nascidos_vivos" in row


# ---- Records ----
def test_records_uf_level(s):
    r = s.get(f"{API}/records", params={"year": 2024}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 27
    assert all(row.get("level") == "uf" for row in rows)


def test_records_mun_level_sp(s):
    r = s.get(f"{API}/records", params={"year": 2024, "uf": "SP"}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert all(row.get("level") == "mun" and row.get("uf") == "SP" for row in rows)


def test_records_search_campinas(s):
    r = s.get(f"{API}/records",
              params={"year": 2024, "uf": "SP", "search": "Campinas"}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    assert any("Campinas" in row["municipality_name"] for row in rows)


# ---- Trends / Causes / Regions ----
def test_trends_sp(s):
    r = s.get(f"{API}/trends", params={"uf": "SP"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 7
    assert all("year" in d and "tmi" in d for d in data)


def test_causes_2024(s):
    r = s.get(f"{API}/causes", params={"year": 2024}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 8


def test_regions_2024(s):
    r = s.get(f"{API}/regions", params={"year": 2024}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 5


# ---- Export ----
def test_export_csv(s):
    r = s.get(f"{API}/export", params={"year": 2024, "uf": "SP"}, timeout=30)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    body = r.text
    assert "codigo_ibge,municipio,uf,regiao,ano" in body.splitlines()[0]
    assert len(body.splitlines()) > 1


# ---- Integrações externas ----
def test_ibge_municipios_ac(s):
    r = s.get(f"{API}/ibge/municipios/AC", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert "nome" in data[0] and "id" in data[0]


def test_cep_sp(s):
    r = s.get(f"{API}/cep/01001000", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["localidade"] == "São Paulo"
    assert d["uf"] == "SP"


def test_cep_invalido(s):
    r = s.get(f"{API}/cep/123", timeout=30)
    assert r.status_code == 400
