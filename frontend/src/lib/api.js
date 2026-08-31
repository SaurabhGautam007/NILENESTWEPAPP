import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("nn_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const BACKEND = process.env.REACT_APP_BACKEND_URL;
