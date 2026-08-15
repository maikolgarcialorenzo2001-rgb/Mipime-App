import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MONEDA_LOCAL } from '../core/constants';

@Pipe({
  name: 'pesos',
  standalone: true,
})
export class PesosPipe implements PipeTransform {
  private readonly _currencyPipe = new CurrencyPipe(inject(LOCALE_ID));

  transform(
    value: number | string | null | undefined,
    digitsInfo = '1.0-0',
  ): string | null {
    return this._currencyPipe.transform(value, MONEDA_LOCAL, 'symbol-narrow', digitsInfo);
  }
}
