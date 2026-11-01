import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  CrudController,
  defineCrudConfig,
  type CrudTransport,
  type EntityId,
  type ListQuery,
  type ListResult,
  type ResolvedCrudConfig,
} from 'crud-maker';
import { CrudListScreen } from './crud-list-screen';

const config: ResolvedCrudConfig = defineCrudConfig({
  key: 'users',
  endpoint: 'admin/users',
  titleField: 'email',
  pageSize: 20,
  searchFields: ['email', 'name'],
  fields: [
    { name: 'id', in: { list: false, form: false, detail: true } },
    { name: 'name', in: { list: true, form: false } },
    { name: 'email', in: { list: true, form: false } },
    {
      name: 'status',
      in: { list: true, form: false },
      filters: ['eq'],
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Suspended', value: 'SUSPENDED' },
      ],
    },
    { name: 'roles', sortable: false, in: { list: true, form: false } },
  ],
});

/** A config with nothing to filter or search: the toolbar must not appear. */
const bareConfig: ResolvedCrudConfig = defineCrudConfig({
  key: 'audit',
  endpoint: 'admin/audit-events',
  fields: [{ name: 'event', in: { list: true, form: false } }],
});

const rows = [{ id: 'u1', email: 'ana@melia.test', status: 'ACTIVE', roles: ['EDITOR'] }];

class FakeTransport implements CrudTransport {
  readonly listCalls: ListQuery[] = [];

  list(_endpoint: string, query: ListQuery): Promise<ListResult> {
    this.listCalls.push(query);
    return Promise.resolve({ rows, total: 1 });
  }
  get(): Promise<Record<string, unknown>> {
    return Promise.resolve(rows[0]!);
  }
  create(_endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.resolve(payload);
  }
  update(
    _endpoint: string,
    _id: EntityId,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return Promise.resolve(payload);
  }
  remove(): Promise<void> {
    return Promise.resolve();
  }
}

const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function setup(conf: ResolvedCrudConfig = config) {
  const transport = new FakeTransport();
  const controller = new CrudController(conf, transport);
  TestBed.configureTestingModule({ imports: [CrudListScreen] });
  const fixture = TestBed.createComponent(CrudListScreen);
  fixture.componentRef.setInput('config', conf);
  fixture.componentRef.setInput('controller', controller);
  fixture.detectChanges();
  return { fixture, transport, controller, element: fixture.nativeElement as HTMLElement };
}

describe('CrudListScreen', () => {
  it('renders a search box and one control per declared filter', () => {
    const { element } = setup();

    expect(element.querySelector('input[type="search"]')).toBeTruthy();
    // The status field declares `eq` with static options, so it becomes a select.
    expect(element.textContent).toContain('status');
    expect(element.querySelector('nz-select')).toBeTruthy();
  });

  it('turns one search term into one request, not one per keystroke', async () => {
    const { element, transport, controller } = setup();
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;

    input.value = 'ana';
    input.dispatchEvent(new Event('input'));
    input.value = 'ana@';
    input.dispatchEvent(new Event('input'));
    await tick(300);

    expect(transport.listCalls).toHaveLength(1);
    expect(transport.listCalls[0]!.search).toBe('ana@');
    expect(controller.state.search()).toBe('ana@');
  });

  it('drives the filter through the core state and can clear it', async () => {
    const { fixture, transport, controller } = setup();

    // The select is a component; the template binds `nz-select` to these handlers,
    // so the test calls the same entry points the user's interaction reaches.
    const component = fixture.componentInstance;
    component['onFilter'](component['filterControls']()[0]!, 'SUSPENDED');
    await tick(300);

    expect(controller.state.getFilter('status', 'eq')).toBe('SUSPENDED');
    expect(transport.listCalls.at(-1)!.filters['status_eq']).toBe('SUSPENDED');

    component['clearFilters']();
    await tick();

    expect(controller.state.getFilter('status', 'eq')).toBeUndefined();
    expect(controller.state.search()).toBeNull();
  });

  it('shows no toolbar when the config exposes nothing to search or filter', () => {
    const { element } = setup(bareConfig);

    expect(element.querySelector('.crud-list-toolbar')).toBeNull();
  });
});
