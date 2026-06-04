import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AdminPage } from './admin.page';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { DATABASE, type Database } from '../../services/database';
import type { UsuarioPublico } from '../../models';

function createMockDb(): Database {
  return {
    sql: vi.fn().mockResolvedValue([]) as unknown as Database['sql'],
    initialize: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAuth(usuarioValue: UsuarioPublico | null = null) {
  const s = signal<UsuarioPublico | null>(usuarioValue);
  return { usuario: s.asReadonly() };
}

describe('AdminPage', () => {
  let fixture: ComponentFixture<AdminPage>;
  let component: AdminPage;
  let userService: UserService;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDb();

    TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [
        provideRouter([]),
        UserService,
        { provide: DATABASE, useValue: mockDb },
        { provide: AuthService, useValue: createMockAuth() },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders loading state initially', async () => {
    let resolveList!: (users: UsuarioPublico[]) => void;
    vi.spyOn(UserService.prototype, 'list').mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('app-loading-spinner');
    expect(spinner).toBeTruthy();

    resolveList([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('2. renders users after load', async () => {
    const users: UsuarioPublico[] = [
      {
        id: 1, nombre: 'admin', rol: 'admin', activo: 1,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2, nombre: 'trabajador1', rol: 'trabajador', activo: 1,
        created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      },
    ];
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue(users);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('admin');
    expect(rows[1].textContent).toContain('trabajador1');
  });

  it('3. shows seed admin with protected indicator', async () => {
    const users: UsuarioPublico[] = [
      {
        id: 1, nombre: 'admin', rol: 'admin', activo: 1,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2, nombre: 'otro', rol: 'trabajador', activo: 1,
        created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      },
    ];
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue(users);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('🔒');
    expect(rows[1].textContent).not.toContain('🔒');
  });

  it('4. shows "(usted)" for current user', async () => {
    // Reconfigure with auth returning current user
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [
        provideRouter([]),
        UserService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: AuthService,
          useValue: createMockAuth({
            id: 2, nombre: 'yo', rol: 'admin', activo: 1,
            created_at: '', updated_at: '',
          }),
        },
      ],
    });

    const users: UsuarioPublico[] = [
      {
        id: 1, nombre: 'admin', rol: 'admin', activo: 1,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2, nombre: 'yo', rol: 'admin', activo: 1,
        created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      },
    ];
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue(users);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[1].textContent).toContain('(usted)');
    expect(rows[0].textContent).not.toContain('(usted)');
  });

  it('5. shows create form on button click', async () => {
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue([]);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    expect(form).toBeTruthy();
    expect(component.showCreateForm()).toBe(true);
  });

  it('6. hides create form on cancel', async () => {
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue([]);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Open form
    component.showCreateForm.set(true);
    fixture.detectChanges();

    // Click cancel button inside form
    const cancelBtn = fixture.nativeElement.querySelector('form button[type="button"]');
    cancelBtn.click();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    expect(form).toBeFalsy();
    expect(component.showCreateForm()).toBe(false);
  });

  it('7. shows error from service', async () => {
    vi.spyOn(UserService.prototype, 'list').mockRejectedValue(
      new Error('Error de prueba'),
    );

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorAlert = fixture.nativeElement.querySelector('app-error-alert');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert.textContent).toContain('Error de prueba');
  });

  it('8. toggle button disabled for self', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [
        provideRouter([]),
        UserService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: AuthService,
          useValue: createMockAuth({
            id: 1, nombre: 'admin', rol: 'admin', activo: 1,
            created_at: '', updated_at: '',
          }),
        },
      ],
    });

    const users: UsuarioPublico[] = [
      {
        id: 1, nombre: 'admin', rol: 'admin', activo: 1,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
    ];
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue(users);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggleBtn = fixture.nativeElement.querySelector('tbody tr td button');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.disabled).toBe(true);
  });

  it('9. role select disabled for seed admin', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [
        provideRouter([]),
        UserService,
        { provide: DATABASE, useValue: mockDb },
        {
          provide: AuthService,
          useValue: createMockAuth({
            id: 2, nombre: 'otro', rol: 'admin', activo: 1,
            created_at: '', updated_at: '',
          }),
        },
      ],
    });

    const users: UsuarioPublico[] = [
      {
        id: 1, nombre: 'admin', rol: 'admin', activo: 1,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2, nombre: 'otro', rol: 'admin', activo: 1,
        created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      },
    ];
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue(users);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('tbody tr td select');
    expect(selects.length).toBe(2);
    expect(selects[0].disabled).toBe(true);
    expect(selects[1].disabled).toBe(false);
  });

  it('shows empty state when no users', async () => {
    vi.spyOn(UserService.prototype, 'list').mockResolvedValue([]);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No hay usuarios registrados');
  });
});
