import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService (R8)', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('success() encola un toast con tipo success y el mensaje dado', () => {
    vi.useFakeTimers();
    service.success('Venta registrada');
    expect(service.toasts()).toEqual([
      expect.objectContaining({ tipo: 'success', mensaje: 'Venta registrada' }),
    ]);
    vi.advanceTimersByTime(4000);
  });

  it('error() e info() encolan su tipo correspondiente', () => {
    vi.useFakeTimers();
    service.error('Falló todo');
    service.info('Sincronizando');
    expect(service.toasts()[0].tipo).toBe('error');
    expect(service.toasts()[1].tipo).toBe('info');
    expect(service.toasts()).toHaveLength(2);
    vi.advanceTimersByTime(4000);
  });

  it('apila los toasts en orden de creación (el último al final)', () => {
    vi.useFakeTimers();
    service.success('Primero');
    service.success('Segundo');
    expect(service.toasts().map((t) => t.mensaje)).toEqual(['Primero', 'Segundo']);
    vi.advanceTimersByTime(4000);
  });

  it('dismiss(id) quita un toast de inmediato y cancela su timer', () => {
    vi.useFakeTimers();
    const toast = service.success('Descartar');
    service.dismiss(toast.id);
    expect(service.toasts()).toHaveLength(0);
    // El timer quedó cancelado: avanzar no debe reintentar la remoción.
    expect(() => vi.advanceTimersByTime(4000)).not.toThrow();
  });

  it('success() se auto-oculta tras 3000ms por defecto', () => {
    vi.useFakeTimers();
    service.success('Auto');
    vi.advanceTimersByTime(2999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('error() se auto-oculta tras 4000ms por defecto', () => {
    vi.useFakeTimers();
    service.error('Auto error');
    vi.advanceTimersByTime(3999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('respeta una duración custom por llamada (2000ms / 2500ms de las páginas)', () => {
    vi.useFakeTimers();
    service.success('Corto', 2000);
    service.success('Medio', 2500);
    vi.advanceTimersByTime(2000);
    expect(service.toasts().map((t) => t.mensaje)).toEqual(['Medio']);
    vi.advanceTimersByTime(500);
    expect(service.toasts()).toHaveLength(0);
  });
});