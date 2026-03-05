// Values injected at build time via angular.json define.
// Production values come from Vercel env vars; dev defaults are in angular.json.
export const environment = {
  production: false,
  apiUrl: import.meta.env.API_URL,
  wssUrl: import.meta.env.WSS_URL,
};
