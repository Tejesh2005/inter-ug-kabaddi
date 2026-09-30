import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  timeout: 5000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

export default http;
