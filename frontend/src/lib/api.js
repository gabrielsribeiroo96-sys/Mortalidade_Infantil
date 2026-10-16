import axios from "axios";

// Vazio = mesma origem (o backend serve o build do React em produção).
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

const params = ({ year, uf, search, allYears } = {}) => {
  const p = {};
  if (year) p.year = year;
  if (uf) p.uf = uf;
  if (search) p.search = search;
  if (allYears) p.all_years = true;
  return p;
};

export const getMeta = () => client.get("/meta").then((r) => r.data);
export const getSummary = (f) => client.get("/summary", { params: params(f) }).then((r) => r.data);
export const getMap = (f) => client.get("/map", { params: params(f) }).then((r) => r.data);
export const getRecords = (f) => client.get("/records", { params: params(f) }).then((r) => r.data);
export const getTrends = (f) => client.get("/trends", { params: params({ uf: f?.uf }) }).then((r) => r.data);
export const getCauses = (f) => client.get("/causes", { params: params(f) }).then((r) => r.data);
export const getRegions = (f) => client.get("/regions", { params: params({ year: f?.year }) }).then((r) => r.data);
export const searchCep = (cep) => client.get(`/cep/${cep}`).then((r) => r.data);

export const exportUrl = (f = {}) => {
  const q = new URLSearchParams();
  if (f.year) q.set("year", f.year);
  if (f.uf) q.set("uf", f.uf);
  return `${API}/export?${q.toString()}`;
};

export const exportDetailedUrl = (f = {}) => {
  const q = new URLSearchParams();
  if (f.uf) q.set("uf", f.uf);
  return `${API}/export/detailed?${q.toString()}`;
};
