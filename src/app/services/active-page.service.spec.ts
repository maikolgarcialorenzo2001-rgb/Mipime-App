import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { ActivePageService, pageIdDeUrl } from './active-page.service';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

const RUTAS: Routes = [
  { path: '', redirectTo: '/pos', pathMatch: 'full' },
  { path: 'pos', component: StubComponent },
  { path: 'jornada', component: StubComponent },
  { path: 'inventario', component: StubComponent },
  { path: 'historial', component: StubComponent },
];

describe('ActivePageService', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(RUTAS)],
    });
    router = TestBed.inject(Router);
  });

  it('inicializa con la página actual al inyectarse (app start tras navegación inicial)', async () => {
    await router.navigateByUrl('/inventario');
    const service = TestBed.inject(ActivePageService);
    expect(service.pagina()).toBe('inventario');
  });

  it('actualiza la signal en cada navegación', async () => {
    const service = TestBed.inject(ActivePageService);
    expect(service.pagina()).toBe('inicio');

    await router.navigateByUrl('/pos');
    expect(service.pagina()).toBe('pos');

    await router.navigateByUrl('/jornada');
    expect(service.pagina()).toBe('jornada');

    await router.navigateByUrl('/historial');
    expect(service.pagina()).toBe('historial');
  });

  it('sigue redirects (ruta vacía → /pos) y resuelve el id de la URL final', async () => {
    const service = TestBed.inject(ActivePageService);
    await router.navigateByUrl('');
    expect(service.pagina()).toBe('pos');
  });

  it('pageIdDeUrl: primer segmento, sin query, y raíz → inicio', () => {
    expect(pageIdDeUrl('/pos')).toBe('pos');
    expect(pageIdDeUrl('/pos?q=term')).toBe('pos');
    expect(pageIdDeUrl('/inventario')).toBe('inventario');
    expect(pageIdDeUrl('/')).toBe('inicio');
    expect(pageIdDeUrl('')).toBe('inicio');
  });
});