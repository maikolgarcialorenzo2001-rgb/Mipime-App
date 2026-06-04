import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { JornadaService } from './jornada.service';
import { DATABASE, type Database } from './database';
import type { Jornada } from '../models';

const mockJornada: Jornada = {
  id: 1,
  fecha: '2026-06-02',
  hora_apertura: '08:00:00',
  hora_cierre: null,
  monto_inicial: 5000,
  total_ventas: 0,
  total_gastos: 0,
  saldo_esperado: 5000,
  saldo_real: null,
  estado: 'abierta',
  created_at: '2026-06-02T08:00:00Z',
  updated_at: '2026-06-02T08:00:00Z',
};

const mockJornadaCerrada: Jornada = {
  ...mockJornada,
  estado: 'cerrada',
  hora_cierre: '18:00:00',
  saldo_real: 7200,
};

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

describe('JornadaService', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      providers: [
        JornadaService,
        { provide: DATABASE, useValue: mockDb },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerAbierta', () => {
    it('debería retornar null cuando no hay jornada abierta', async () => {
      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toBeNull();
      expect(mockDb.sql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String), 'abierta'],
      );
    });

    it('debería retornar la jornada abierta cuando existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.obtenerAbierta());

      expect(resultado).toEqual(mockJornada);
      expect(resultado!.estado).toBe('abierta');
    });

    it('debería lanzar error si la DB falla', async () => {
      vi.mocked(mockDb.sql).mockRejectedValue(new Error('Connection error'));

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.obtenerAbierta()),
      ).rejects.toThrow('Connection error');
    });
  });

  describe('abrir', () => {
    it('debería crear una nueva jornada con monto inicial', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.abrir(5000));

      expect(resultado.monto_inicial).toBe(5000);
      expect(resultado.estado).toBe('abierta');
    });
  });

  describe('cerrar', () => {
    it('debería cerrar la jornada con el saldo real', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.cerrar(1, 7200));

      expect(resultado.estado).toBe('cerrada');
      expect(resultado.saldo_real).toBe(7200);
    });

    it('debería lanzar error si la jornada no existe', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([]);

      const service = TestBed.inject(JornadaService);

      await expect(
        firstValueFrom(service.cerrar(999, 0)),
      ).rejects.toThrow('Jornada no encontrada');
    });
  });

  describe('historial', () => {
    it('debería retornar lista de jornadas', async () => {
      vi.mocked(mockDb.sql).mockResolvedValue([mockJornada, mockJornadaCerrada]);

      const service = TestBed.inject(JornadaService);
      const resultado = await firstValueFrom(service.historial(10));

      expect(resultado).toHaveLength(2);
    });
  });
});
