import type {
  PalmarRecord,
  PalmarProductoEntry,
  PalmarDivisa,
  PalmarSemanaResumen,
  PalmarHistoryEntry,
} from './palmar-jornada';
import type { ArqueoCajaEntry } from './arqueo-caja';

describe('Palmar models', () => {
  it('debería crear un PalmarRecord completo con divisa, transferencia y ganancia', () => {
    const divisa: PalmarDivisa = {
      usd: 10,
      eur: 5,
      tasa_usd: 320,
      tasa_eur: 350,
      usd_cup: 3200,
      eur_cup: 1750,
      divisa_cup: 4950,
    };
    const arqueo: ArqueoCajaEntry[] = [
      { denominacion: 5000, cantidad: 2, subtotal: 10000 },
      { denominacion: 3, cantidad: 1, subtotal: 3 },
    ];
    const productos: PalmarProductoEntry[] = [
      {
        nombre: 'Pan',
        cantidad: 2,
        precio_venta: 50,
        precio_costo: 30,
        subtotal: 100,
        costo_subtotal: 60,
      },
    ];
    const record: PalmarRecord = {
      version: 1,
      id: '2026-08-09',
      fecha: '2026-08-09',
      created_at: '2026-08-09T18:00:00Z',
      usuario: 'Admin',
      productos,
      arqueo,
      divisa,
      transferencia: 2000,
      total_ventas: 100,
      total_arqueo: 10003,
      total_recibido: 16953,
      invertido: 60,
      ganancia: 16893,
      diferencia: -16853,
    };

    expect(record.version).toBe(1);
    expect(record.usuario).toBe('Admin');
    expect(record.arqueo).toEqual(arqueo);
    expect(record.productos[0].costo_subtotal).toBe(60);
    expect(record.divisa.divisa_cup).toBe(4950);
    expect(record.total_recibido).toBe(16953);
    expect(record.ganancia).toBe(record.total_recibido - record.invertido);
    expect(record.diferencia).toBe(record.total_ventas - record.total_recibido);
  });

  it('debería crear un PalmarRecord con usuario null y listas vacías', () => {
    const record: PalmarRecord = {
      version: 1,
      id: '2026-08-08',
      fecha: '2026-08-08',
      created_at: '2026-08-08T18:00:00Z',
      usuario: null,
      productos: [],
      arqueo: [],
      divisa: { usd: 0, eur: 0, tasa_usd: 320, tasa_eur: 350, usd_cup: 0, eur_cup: 0, divisa_cup: 0 },
      transferencia: 0,
      total_ventas: 0,
      total_arqueo: 0,
      total_recibido: 0,
      invertido: 0,
      ganancia: 0,
      diferencia: 0,
    };

    expect(record.usuario).toBeNull();
    expect(record.productos).toHaveLength(0);
    expect(record.arqueo).toHaveLength(0);
    expect(record.version).toBe(1);
  });

  it('debería crear un PalmarSemanaResumen con el desglose semanal', () => {
    const resumen: PalmarSemanaResumen = {
      semanaInicio: '2026-08-03',
      semanaFin: '2026-08-09',
      totalRecibido: 50000,
      efectivo: 30000,
      divisaCup: 15000,
      transferencia: 5000,
      invertido: 20000,
      ganancia: 30000,
    };

    expect(resumen.semanaInicio).toBe('2026-08-03');
    expect(resumen.semanaFin).toBe('2026-08-09');
    expect(resumen.ganancia).toBe(30000);
    expect(resumen.totalRecibido).toBe(resumen.efectivo + resumen.divisaCup + resumen.transferencia);
  });

  it('debería crear un PalmarHistoryEntry con totalRecibido y usuario opcional', () => {
    const entry: PalmarHistoryEntry = {
      fileName: '09-08-2026.xlsx',
      createdAt: '2026-08-09T18:00:00Z',
      totalVentas: 100,
      totalArqueo: 10003,
      totalRecibido: 16953,
      usuario: null,
    };

    expect(entry.fileName).toBe('09-08-2026.xlsx');
    expect(entry.totalRecibido).toBe(16953);
    expect(entry.usuario).toBeNull();
  });
});
