/**
 * `crud-cell` — the smallest real adapter (S9): it renders a core `CellView`
 * with ng-zorro primitives and decides nothing else.
 *
 * The core already resolved the text and the variant, so this component never
 * formats or inspects the raw value. What it does own is the mapping from the
 * declarative hint to its own vocabulary, and that mapping is not symmetric:
 * `nz-tag` accepts any color name, so the variant passes through untouched,
 * while `nz-badge` takes a closed status union. An unknown variant therefore
 * degrades to `default` instead of pushing a free-form string into a typed API.
 */
import { Component, computed, input, OnDestroy, signal } from '@angular/core';
import { resolveCellView, type CellView, type ResolvedField } from 'ng-crud-maker';
import { NzBadgeModule, type NzBadgeStatusType } from 'ng-zorro-antd/badge';
import { NzTagModule, type NzTagColor } from 'ng-zorro-antd/tag';

const NZ_STATUSES: readonly NzBadgeStatusType[] = [
  'success',
  'processing',
  'default',
  'error',
  'warning',
];

@Component({
  selector: 'crud-cell',
  imports: [NzBadgeModule, NzTagModule],
  template: `
    @switch (view().kind) {
      @case ('badge') {
        <nz-badge [nzStatus]="status()" [nzText]="view().text" />
      }
      @case ('tag') {
        <nz-tag [nzColor]="color()" [attr.title]="hint()">{{ view().text }}</nz-tag>
      }
      @case ('dot') {
        <nz-badge [nzStatus]="status()" />
      }
      @default {
        <span [attr.title]="hint()">{{ view().text }}</span>
        @if (hint(); as full) {
          <button
            type="button"
            class="crud-copy"
            [attr.aria-label]="'Copy ' + full"
            [title]="copied() ? 'Copied' : 'Copy the full value'"
            (click)="copy(full)"
          >
            @if (copied()) {
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m5 13 4 4 10-11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            } @else {
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.9" />
                <path d="M15 6H6a2 2 0 0 0-2 2v9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            }
          </button>
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      /* Only under a truncated value: a copy affordance for a full value is noise. */
      .crud-copy {
        display: inline-grid;
        place-items: center;
        padding: 2px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--muted, rgba(0, 0, 0, 0.45));
        cursor: pointer;
        opacity: 0.75;
      }
      .crud-copy:hover,
      .crud-copy:focus-visible {
        opacity: 1;
        color: var(--ink, #111);
      }
    `,
  ],
})
export class CrudCell implements OnDestroy {
  readonly field = input.required<ResolvedField>();
  readonly value = input<unknown>();

  readonly view = computed<CellView>(() => resolveCellView(this.field(), this.value()));

  /** Variant mapped onto the closed zorro status union; never the raw hint. */
  readonly status = computed<NzBadgeStatusType>(() => toStatus(this.view().variant));

  /** Variant as a zorro tag color, or undefined when the value declares none. */
  readonly color = computed<NzTagColor | undefined>(() => this.view().variant ?? undefined);

  /**
   * The value the cell could not show in full — a truncating formatter, say. It
   * becomes the native `title`, which is the cheapest way to keep the complete value
   * reachable without pulling a tooltip library into every table.
   */
  /** Set for a moment after a successful copy, so the click has visible feedback. */
  readonly copied = signal(false);
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  /**
   * Copies the untruncated value. A tooltip can be read but not selected, so without
   * this the full hash of an event could never reach the filter that needs it.
   */
  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(true);
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.copied.set(false), 1_200);
    } catch {
      // Clipboard denied (insecure context, permissions): leave the click silent
      // rather than claim a copy that did not happen.
    }
  }

  readonly hint = computed<string | null>(() => {
    const raw = this.value();
    if (raw === null || raw === undefined) return null;
    const full = String(raw);
    return full !== '' && full !== this.view().text ? full : null;
  });
}

function toStatus(variant: string | null): NzBadgeStatusType {
  const safe = variant ?? '';
  return NZ_STATUSES.find((status) => status === safe) ?? 'default';
}
