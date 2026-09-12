import {
  AnimationMetadataType,
  type AnimationAnimateMetadata,
  type AnimationMetadata,
  type AnimationStyleMetadata,
  type AnimationTransitionMetadata,
} from '@angular/animations';
import { routeAnimations } from './route.transitions';

function transiciones(): AnimationTransitionMetadata[] {
  return routeAnimations.definitions.filter(
    (d: AnimationMetadata): d is AnimationTransitionMetadata => 'expr' in d,
  );
}

describe('R7: transiciones de ruta (fade + slide) — route.transitions', () => {
  it('debería exportar un trigger llamado routeAnimations', () => {
    expect(routeAnimations.name).toBe('routeAnimations');
  });

  it('debería animar SOLO :enter — sin :leave (preserva POS full-bleed sin absolute-positioning)', () => {
    const exprs = transiciones().map((t) => String(t.expr));

    expect(exprs).toContain(':enter');
    expect(exprs).not.toContain(':leave');
  });

  it('el :enter debería hacer fade + slide de 8px en 0.15–0.2s (180ms ease-out)', () => {
    const enter = transiciones().find((t) => String(t.expr) === ':enter');
    expect(enter).toBeDefined();

    const secuencia = enter!.animation;
    const pasos = (Array.isArray(secuencia) ? secuencia : [secuencia]) as AnimationMetadata[];

    const desde = pasos[0] as AnimationStyleMetadata;
    expect(desde.type).toBe(AnimationMetadataType.Style);
    const propsDesde = desde.styles as Record<string, string | number>;
    expect(String(propsDesde['opacity'])).toBe('0');
    expect(String(propsDesde['transform'])).toContain('translateY(8px)');

    const animacion = pasos[1] as AnimationAnimateMetadata;
    expect(animacion.timings).toBe('180ms ease-out');

    const hacia = animacion.styles as AnimationStyleMetadata;
    const propsHacia = hacia.styles as Record<string, string | number>;
    expect(String(propsHacia['opacity'])).toBe('1');
    expect(String(propsHacia['transform'])).toContain('translateY(0)');
  });

  it('debería declarar exactamente una transición (la de :enter) — sin estados ni extras', () => {
    expect(transiciones()).toHaveLength(1);
    expect(String(transiciones()[0].expr)).toBe(':enter');
  });
});