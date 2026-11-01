/**
 * `crud-list-screen` — the whole list page of the ng-zorro adapter: toolbar plus table.
 *
 * The table alone leaves the consumer writing a search box and one control per
 * declared filter in every screen — exactly the copy-paste this package exists to
 * remove. The toolbar is derived from the config: `searchFields` decides whether a
 * search box appears, and every field exposing a supported filter kind gets its
 * control. Nothing here decides what to show; it only translates controls into the
 * core's `CrudListState`, which owns paging, search and filters.
 *
 * Supported filter kinds, in the order preferred per field: `eq`, `like`, `gte`,
 * `between`. A range (`between`) renders a from/to pair with a native date input.
 * A field exposing only `in` gets no control yet, instead of a control that could
 * not work.
 */
import { Component, computed, input, output, signal, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CrudController,
  type FilterKind,
  type ResolvedCrudConfig,
  type ResolvedField,
} from 'crud-maker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzOptionComponent, NzSelectModule } from 'ng-zorro-antd/select';
import { CrudTable } from '../table/crud-table';

/** The kinds this toolbar can drive, in preference order. */
const SUPPORTED_KINDS: readonly FilterKind[] = ['eq', 'like', 'gte', 'between'];

/** How long a keystroke waits before it becomes a request. */
const DEBOUNCE_MS = 250;

interface FilterControl {
  field: ResolvedField;
  kind: FilterKind;
  /** Static option list, when the field declares one; the control becomes a select. */
  options: readonly { label: string; value: string }[];
  numeric: boolean;
  /** A from/to pair instead of a single input. */
  range: boolean;
  /** Native input type for a range control. */
  inputType: 'date' | 'datetime-local';
}

@Component({
  selector: 'crud-list-screen',
  imports: [CrudTable, FormsModule, NzButtonModule, NzInputModule, NzOptionComponent, NzSelectModule],
  template: `
    <div class="crud-list-screen">
      @if (hasToolbar()) {
        <div class="crud-list-toolbar">
          @if (searchable()) {
            <label class="crud-toolbar-field">
              <span>Search</span>
              <input
                nz-input
                type="search"
                placeholder="Search"
                autocomplete="off"
                [value]="searchTerm()"
                (input)="onSearch($any($event.target).value)"
              />
            </label>
          }

          @for (control of filterControls(); track control.field.name) {
            <label
              class="crud-toolbar-field"
              [class.crud-toolbar-field--range]="control.range"
            >
              <span>{{ control.field.label }}</span>
              @if (control.range) {
                <span class="crud-toolbar-range">
                  <input
                    nz-input
                    [type]="control.inputType"
                    aria-label="From"
                    [value]="filterValue(edgeKey(control.field.name, 'from'))"
                    (input)="onRange(control, 'from', $any($event.target).value)"
                  />
                  <input
                    nz-input
                    [type]="control.inputType"
                    aria-label="To"
                    [value]="filterValue(edgeKey(control.field.name, 'to'))"
                    (input)="onRange(control, 'to', $any($event.target).value)"
                  />
                </span>
              } @else if (control.options.length) {
                <nz-select
                  nzAllowClear
                  [nzPlaceHolder]="control.field.label"
                  [ngModel]="filterValue(control.field.name)"
                  (ngModelChange)="onFilter(control, $event)"
                >
                  @for (option of control.options; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.label" />
                  }
                </nz-select>
              } @else {
                <input
                  nz-input
                  [type]="control.numeric ? 'number' : 'text'"
                  [placeholder]="control.field.label"
                  autocomplete="off"
                  [value]="filterValue(control.field.name)"
                  (input)="onFilter(control, $any($event.target).value)"
                />
              }
            </label>
          }

          @if (hasAnyValue()) {
            <button nz-button type="button" (click)="clearFilters()">Clear</button>
          }
        </div>
      }

      @if (error(); as message) {
        <p class="crud-list-error" role="alert">{{ message }}</p>
      }

      <crud-table
        [config]="config()"
        [controller]="controller()"
        [rowActions]="rowActions()"
        (edit)="edit.emit($event)"
        (remove)="remove.emit($event)"
      />
    </div>
  `,
  styles: [
    `
      .crud-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 14px;
      }
      .crud-toolbar-field {
        display: grid;
        gap: 5px;
        min-width: 200px;
        max-width: 320px;
      }
      /* Colours come from the host's variables when it has them, so the screen
         follows a light/dark theme without the package knowing about themes. */
      .crud-toolbar-field span {
        font-size: 12px;
        color: var(--muted, rgba(0, 0, 0, 0.55));
      }
      .crud-toolbar-range {
        display: flex;
        gap: 6px;
      }
      /* Native date inputs refuse to shrink below their intrinsic width, so the pair
         needs room of its own and each input must be allowed to flex. */
      .crud-toolbar-field--range {
        max-width: 420px;
      }
      .crud-toolbar-range input {
        flex: 1 1 0;
        min-width: 0;
      }
      .crud-list-error {
        margin: 0 0 12px;
        color: var(--tag-danger-ink, #cf1322);
      }
    `,
  ],
})
export class CrudListScreen<T extends object = Record<string, unknown>> {
  readonly config = input.required<ResolvedCrudConfig>();
  readonly controller = input.required<CrudController<T>>();

  /** Optional per-row actions owned by the consumer, forwarded to the table. */
  readonly rowActions = input<TemplateRef<{ $implicit: T }> | null>(null);

  /** A row the consumer should open for editing. */
  readonly edit = output<T>();
  /** A row the consumer should delete, after its own confirmation. */
  readonly remove = output<T>();

  protected readonly searchTerm = signal('');
  protected readonly filterValues = signal<Readonly<Record<string, string>>>({});

  protected readonly searchable = computed(() => this.config().searchFields.length > 0);

  protected readonly filterControls = computed<readonly FilterControl[]>(() =>
    this.config()
      .fields.filter((field) => field.filters.length > 0)
      .map((field) => this.controlFor(field))
      .filter((control): control is FilterControl => control !== null),
  );

  protected readonly hasToolbar = computed(
    () => this.searchable() || this.filterControls().length > 0,
  );

  /** True when a control holds a value, so "Clear" only appears when it does something. */
  protected readonly hasAnyValue = computed(() => {
    if (this.searchTerm().trim() !== '') return true;
    return Object.values(this.filterValues()).some((value) => value.trim() !== '');
  });

  protected readonly error = computed(() => this.controller().error());

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  protected onSearch(value: string): void {
    this.searchTerm.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.controller().state.setSearch(value);
      void this.controller().load();
    }, DEBOUNCE_MS);
  }

  protected onFilter(control: FilterControl, value: string): void {
    const raw = typeof value === 'string' ? value : String(value ?? '');
    this.filterValues.set({ ...this.filterValues(), [control.field.name]: raw });
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => {
      // An emptied control clears its filter instead of sending an empty string.
      const next = raw.trim() === '' ? undefined : raw;
      this.controller().state.setFilter(control.field.name, control.kind, next);
      void this.controller().load();
    }, DEBOUNCE_MS);
  }

  protected filterValue(key: string): string {
    return this.filterValues()[key] ?? '';
  }

  /** Range edges live beside single values, keyed per edge. */
  protected edgeKey(fieldName: string, edge: 'from' | 'to'): string {
    return `${fieldName}__${edge}`;
  }

  protected onRange(control: FilterControl, edge: 'from' | 'to', value: string): void {
    this.filterValues.set({ ...this.filterValues(), [this.edgeKey(control.field.name, edge)]: value });
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => {
      const from = this.filterValue(this.edgeKey(control.field.name, 'from')).trim();
      const to = this.filterValue(this.edgeKey(control.field.name, 'to')).trim();
      // The engine's `between` takes exactly two edges; both empty clears the filter.
      const next = from === '' && to === '' ? undefined : [from === '' ? null : from, to === '' ? null : to];
      this.controller().state.setFilter(control.field.name, control.kind, next);
      void this.controller().load();
    }, DEBOUNCE_MS);
  }

  protected clearFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.searchTimer = null;
    this.filterTimer = null;
    this.searchTerm.set('');
    this.filterValues.set({});
    this.controller().state.clearFilters();
    this.controller().state.setSearch(null);
    void this.controller().load();
  }

  private controlFor(field: ResolvedField): FilterControl | null {
    const kind = SUPPORTED_KINDS.find((candidate) => field.filters.includes(candidate));
    if (!kind) return null;
    const options = Array.isArray(field.options)
      ? field.options.map((option) => ({ label: option.label, value: String(option.value) }))
      : [];
    return {
      field,
      kind,
      options,
      numeric: field.type === 'number' && kind !== 'like',
      range: kind === 'between',
      inputType: field.type === 'date' ? 'date' : 'datetime-local',
    };
  }
}
