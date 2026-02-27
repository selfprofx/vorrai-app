// Runtime configuration — values are injected at deploy time via window globals
// in index.html (same pattern used for Cognito IDs).
//
// To configure locally, add to index.html:
//   <script>
//     window.__API_URL__ = 'https://your-api-id.execute-api.us-east-1.amazonaws.com/api';
//     window.__WSS_URL__ = 'wss://your-ws-id.execute-api.us-east-1.amazonaws.com/api';
//   </script>

declare const window: any;

export const environment = {
  production: false,
  apiUrl: window.__API_URL__ ?? 'http://localhost:8000',
  wssUrl: window.__WSS_URL__ ?? 'ws://localhost:8000',
};
