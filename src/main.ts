import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { APP_VERSION } from './app/version';

bootstrapApplication(App, appConfig)
  .then(() => {
    // BACKLOG-1: el título de ventana/pestaña siempre en sync con package.json
    // (la versión viene de APP_VERSION, generado en build por sync-version.mjs).
    document.title = `Tienda-App ${APP_VERSION}`;
  })
  .catch((err) => {
    // T6: si el bootstrap falla (p.ej. proveedor roto), nunca dejar la
    // pantalla en blanco: mensaje mínimo en <app-root>.
    console.error(err);
    const root = document.querySelector('app-root');
    if (root) {
      root.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;font-family:system-ui,sans-serif;color:#374151">' +
        '<div><h1 style="font-size:1.25rem;font-weight:600;margin-bottom:0.5rem">No se pudo iniciar la aplicación</h1>' +
        '<p style="font-size:0.875rem">Contacte al desarrollador.</p></div></div>';
    }
  });
