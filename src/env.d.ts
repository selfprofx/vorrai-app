interface ImportMetaEnv {
  readonly COGNITO_USER_POOL_ID: string;
  readonly COGNITO_CLIENT_ID: string;
  readonly API_URL: string;
  readonly WSS_URL: string;
  readonly TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
