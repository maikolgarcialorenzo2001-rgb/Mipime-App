import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { JornadaPage } from './jornada.page';
import { JornadaService } from '../../services/jornada.service';
import { AuthService } from '../../services/auth.service';
import type { Jornada } from '../../models';
import type { UsuarioPublico } from '../../models';

const mockJornadaAbierta: Jornada = {
  id: 1,
  fecha: '2026-06-04',
  hora_apertura: '09:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 15000,
  total_gastos: 2000,
  saldo_esperado: 18000,
  saldo_real: null,
  estado: 'abierta',
  user_cierre_id: null,
  created_at: '2026-06-04T09:00:00Z',
  updated_at: '2026-06-04T09:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornadaAbierta,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 17800,
  user_cierre_id: 1,
};

const mockAdmin: UsuarioPublico = {
  id: 1,
  nombre: 'Admin',
  rol: 'admin',
  activo: 1,
  created_at: '',
  updated_at: '',
};

const mockWorker: UsuarioPublico = {
  id: 2,
  nombre: 'Worker',
  rol: 'trabajador',
  activo: 1,
  created_at: '',
  updated_at: '',
};

function createMockAuth(usuarioValue: UsuarioPublico | null) {
  const s = signal<UsuarioPublico | null>(usuarioValue);
  return {
    usuario: s.asReadonly(),
    hasRole: (role: string) => usuarioValue?.rol === role,
  };
}

describe('JornadaPage', () => {
  describe('con jornada abierta — admin', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: {
              obtenerAbierta: () => of(mockJornadaAbierta),
              cerrar: vi.fn().mockReturnValue(of(mockJornadaCerrada)),
              obtenerReporte: vi.fn().mockReturnValue(of(null)),
            },
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería crearse', () => {
      expect(component).toBeTruthy();
    });

    it('debería mostrar el resumen de la jornada', () => {
      const card = fixture.nativeElement.querySelector('app-jornada-summary-card');
      expect(card).toBeTruthy();
    });

    it('debería mostrar botón "Cerrar jornada" para admin', () => {
      const btn = fixture.nativeElement.querySelector('button');
      expect(btn?.textContent?.trim()).toContain('Cerrar jornada');
    });

    it('debería abrir modal al hacer click en cerrar', () => {
      component.abrirModalCierre();
      fixture.detectChanges();
      expect(component.showCloseModal()).toBe(true);
    });

    it('debería cerrar modal con Escape', () => {
      component.abrirModalCierre();
      component.onModalKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(component.showCloseModal()).toBe(false);
    });
  });

  describe('con jornada abierta — worker', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: {
              obtenerAbierta: () => of(mockJornadaAbierta),
            },
          },
          { provide: AuthService, useValue: createMockAuth(mockWorker) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('NO debería mostrar botón de cerrar para worker', () => {
      const btn = fixture.nativeElement.querySelector('button');
      expect(btn).toBeFalsy();
    });
  });

  describe('sin jornada abierta', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: {
              obtenerAbierta: () => of(null),
            },
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      fixture.detectChanges();
    });

    it('debería mostrar empty state si no hay jornada', () => {
      const empty = fixture.nativeElement.querySelector('app-empty-state');
      expect(empty).toBeTruthy();
    });
  });

  describe('error al cargar jornada', () => {
    let fixture: ComponentFixture<JornadaPage>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: {
              obtenerAbierta: () => of(null),
            },
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      const component = fixture.componentInstance;
      component.error.set('Error al cargar');
      fixture.detectChanges();
    });

    it('debería mostrar error si hay error', () => {
      const error = fixture.nativeElement.querySelector('app-error-alert');
      expect(error).toBeTruthy();
    });
  });

  describe('cierre de jornada', () => {
    let fixture: ComponentFixture<JornadaPage>;
    let component: JornadaPage;
    let cerrarSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      cerrarSpy = vi.fn().mockReturnValue(of(mockJornadaCerrada));

      TestBed.configureTestingModule({
        imports: [JornadaPage],
        providers: [
          {
            provide: JornadaService,
            useValue: {
              obtenerAbierta: () => of(mockJornadaAbierta),
              cerrar: cerrarSpy,
              obtenerReporte: vi.fn().mockReturnValue(of({
                id: 1,
                jornada_id: 1,
                content_type: 'excel',
                content_base64: '',
                filename: 'jornada_2026-06-04_1.xlsx',
                created_at: '',
              })),
            },
          },
          { provide: AuthService, useValue: createMockAuth(mockAdmin) },
        ],
      });

      fixture = TestBed.createComponent(JornadaPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('debería llamar a cerrar() con jornadaId, saldoReal y userId', () => {
      component.abrirModalCierre();
      component.onSaldoRealChange('17800');
      component.confirmarCierre();

      expect(cerrarSpy).toHaveBeenCalledWith(1, 17800, 1);
    });

    it('no debería llamar a cerrar() si saldoReal es null', () => {
      component.abrirModalCierre();
      component.confirmarCierre();

      expect(cerrarSpy).not.toHaveBeenCalled();
    });

    it('debería mostrar error si confirmarCierre falla', () => {
      component.abrirModalCierre();
      component.cerrarError.set('Error de DB');
      fixture.detectChanges();

      const errorEl: HTMLElement | null = fixture.nativeElement.querySelector('.bg-red-50');
      expect(errorEl?.textContent).toContain('Error de DB');
    });
  });
});
