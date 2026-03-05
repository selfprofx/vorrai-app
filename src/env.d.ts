interface ImportMetaEnv {
  readonly COGNITO_USER_POOL_ID: string;
  readonly COGNITO_CLIENT_ID: string;
  readonly API_URL: string;
  readonly WSS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
