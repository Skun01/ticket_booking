import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { CurrentUser, SessionService } from './session.service';

const admin: CurrentUser = { id: 1, email: 'admin@example.test', fullName: 'Admin', role: 'ADMIN' };

describe('adminGuard', () => {
  let user: CurrentUser | null;
  let initialized: boolean;

  beforeEach(() => {
    user = null;
    initialized = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: {
            initialize: async () => {
              initialized = true;
            },
            user: () => user,
            isAdmin: () => user?.role === 'ADMIN',
          },
        },
      ],
    });
  });

  async function run() {
    return TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }

  it('waits for initialization and sends anonymous users to login', async () => {
    const result = await run();
    expect(initialized).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('sends USER to the forbidden page', async () => {
    user = { ...admin, role: 'USER' };
    const result = await run();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('allows ADMIN', async () => {
    user = admin;
    expect(await run()).toBe(true);
  });
});
