import { environment } from './environment';
import { environment as envProd } from './environment.prod';
import { environment as envTest } from './environment.test';

describe('Environment files - no hardcoded admin credentials', () => {
  it('environment.ts should not contain adminUser or adminPassword', () => {
    expect(environment).not.toHaveProperty('adminUser');
    expect(environment).not.toHaveProperty('adminPassword');
    expect(environment).toHaveProperty('dbName');
    expect(environment).toHaveProperty('production');
    expect(environment).toHaveProperty('seedEnabled');
    expect(environment).toHaveProperty('testMode');
    expect(environment).toHaveProperty('ttlDays');
  });

  it('environment.prod.ts should not contain adminUser or adminPassword', () => {
    expect(envProd).not.toHaveProperty('adminUser');
    expect(envProd).not.toHaveProperty('adminPassword');
    expect(envProd).toHaveProperty('dbName');
    expect(envProd).toHaveProperty('production', true);
    expect(envProd).toHaveProperty('seedEnabled');
    expect(envProd).toHaveProperty('testMode');
    expect(envProd).toHaveProperty('ttlDays');
  });

  it('environment.test.ts should not contain adminUser or adminPassword but keep seedEnabled: true', () => {
    expect(envTest).not.toHaveProperty('adminUser');
    expect(envTest).not.toHaveProperty('adminPassword');
    expect(envTest).toHaveProperty('dbName');
    expect(envTest).toHaveProperty('production', true);
    expect(envTest).toHaveProperty('seedEnabled', true);
    expect(envTest).toHaveProperty('testMode', true);
    expect(envTest).toHaveProperty('ttlDays');
  });
});