import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mipime.cuentas',
  appName: 'Tienda - App',
  webDir: 'dist/Mipime-Cuentas/browser',
  server: {
    // Para dev: apuntar al dev server de Angular
    // url: 'http://192.168.x.x:4200',
    // cleartext: true,
  },
  android: {
    // Permitir Mixed Content (HTTP dentro de HTTPS) para OPFS local
    allowMixedContent: true,
  },
  plugins: {
    // Capacitor no maneja SQLocal — lo dejamos pasar al WebView
  },
};

export default config;
