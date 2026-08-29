import { TestBed } from '@angular/core/testing';
import { AdminPage } from './admin.page';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { signal } from '@angular/core';
import type { UsuarioPublico } from '../../models';

describe('AdminPage', () => {
  let mockUserService: Partial<UserService>;
  let mockAuthService: Partial<AuthService>;

  beforeEach(() => {
    mockUserService = {
      list: vi.fn(),
      toggleActivo: vi.fn(),
      updateRol: vi.fn(),
      updatePassword: vi.fn(),
      getActiveAdminCount: vi.fn(),
    };

    mockAuthService = {
      usuario: signal(null),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should compute activeAdminCount from UserService', async () => {
    mockUserService.getActiveAdminCount!.mockResolvedValue(2);
    mockUserService.list!.mockResolvedValue([]);

    const component = TestBed.createComponent(AdminPage).componentInstance;
    await component.ngOnInit();

    expect(mockUserService.getActiveAdminCount).toHaveBeenCalled();
    expect(component.activeAdminCount()).toBe(2);
  });

  it('should disable deactivation when activeAdminCount is 1', async () => {
    mockUserService.getActiveAdminCount!.mockResolvedValue(1);
    mockUserService.list!.mockResolvedValue([
      { id: 1, nombre: 'admin', rol: 'admin', activo: 1, created_at: '', updated_at: '' },
    ]);

    const component = TestBed.createComponent(AdminPage).componentInstance;
    await component.ngOnInit();

    expect(component.activeAdminCount()).toBe(1);
    // isLastAdmin should be true when count === 1
    expect(component.isLastAdmin(1)).toBe(true);
  });

  it('should allow deactivation when activeAdminCount > 1', async () => {
    mockUserService.getActiveAdminCount!.mockResolvedValue(2);
    mockUserService.list!.mockResolvedValue([
      { id: 1, nombre: 'admin1', rol: 'admin', activo: 1, created_at: '', updated_at: '' },
      { id: 2, nombre: 'admin2', rol: 'admin', activo: 1, created_at: '', updated_at: '' },
    ]);

    const component = TestBed.createComponent(AdminPage).componentInstance;
    await component.ngOnInit();

    expect(component.activeAdminCount()).toBe(2);
    expect(component.isLastAdmin(1)).toBe(false);
    expect(component.isLastAdmin(2)).toBe(false);
  });
});