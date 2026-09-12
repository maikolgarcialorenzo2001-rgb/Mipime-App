import { TestBed } from '@angular/core/testing';
import { BrandService } from './brand.service';
import { SetupService } from './setup.service';
import { APP_VERSION } from '../version';

describe('BrandService (R6: nombre_comercio + fallback Mipime POS)', () => {
  let getConfig: ReturnType<typeof vi.fn>;
  let brand: BrandService;

  beforeEach(() => {
    getConfig = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: SetupService, useValue: { getConfig } }],
    });
    brand = TestBed.inject(BrandService);
    document.title = 'titulo-inicial';
  });

  afterEach(() => {
    document.title = '';
  });

  it('expone nombreComercio null mientras no se cargó', () => {
    expect(brand.nombreComercio()).toBeNull();
  });

  it('cargar() lee nombre_comercio exactamente una vez aunque se llame varias veces', async () => {
    getConfig.mockResolvedValue('Panadería La Espiga');

    await brand.cargar();
    await brand.cargar();

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(getConfig).toHaveBeenCalledWith('nombre_comercio');
  });

  it('sin nombre_comercio en config: señal null y título = "Mipime POS <versión>"', async () => {
    getConfig.mockResolvedValue(null);

    await brand.cargar();
    TestBed.flushEffects();

    expect(brand.nombreComercio()).toBeNull();
    expect(document.title).toBe(`Mipime POS ${APP_VERSION}`);
  });

  it('con nombre_comercio configurado: señal con el nombre y título = "<nombre> <versión>"', async () => {
    getConfig.mockResolvedValue('Panadería La Espiga');

    await brand.cargar();
    TestBed.flushEffects();

    expect(brand.nombreComercio()).toBe('Panadería La Espiga');
    expect(document.title).toBe(`Panadería La Espiga ${APP_VERSION}`);
  });

  it('si la lectura de config falla, el shell no se rompe: señal null y fallback en el título', async () => {
    getConfig.mockRejectedValue(new Error('db no disponible'));

    await brand.cargar();
    TestBed.flushEffects();

    expect(brand.nombreComercio()).toBeNull();
    expect(document.title).toBe(`Mipime POS ${APP_VERSION}`);
  });
});