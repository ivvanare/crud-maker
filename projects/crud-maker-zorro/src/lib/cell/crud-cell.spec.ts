import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defineCrudConfig, type ResolvedField } from 'ng-crud-maker';
import { CrudCell } from './crud-cell';

function resolveField(cell?: Record<string, unknown>): ResolvedField {
  const config = defineCrudConfig({
    key: 'faqs',
    endpoint: 'faqs',
    fields: [{ name: 'status', ...(cell ? { cell } : {}) }],
  });
  const field = config.fieldMap.get('status');
  if (!field) throw new Error('field "status" was not resolved');
  return field;
}

async function render(field: ResolvedField, value: unknown) {
  const fixture = TestBed.createComponent(CrudCell);
  fixture.componentRef.setInput('field', field);
  fixture.componentRef.setInput('value', value);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** A field whose formatter shortens the value the cell receives. */
function truncatedField(): ResolvedField {
  const config = defineCrudConfig({
    key: 'audit-events',
    endpoint: 'admin/audit-events',
    fields: [
      { name: 'email_hash', formatter: { name: 'truncate', params: { length: 8 } } },
    ],
  });
  const field = config.fieldMap.get('email_hash');
  if (!field) throw new Error('field "email_hash" was not resolved');
  return field;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('CrudCell', () => {
  it('renders a plain value as text, with no zorro primitive', async () => {
    const host = await render(resolveField(), 'draft');
    expect(host.textContent?.trim()).toBe('draft');
    expect(host.querySelector('nz-tag')).toBeNull();
    expect(host.querySelector('nz-badge')).toBeNull();
  });

  it('offers no copy button when the value is shown in full', async () => {
    const host = await render(resolveField(), 'draft');

    expect(host.querySelector('button.crud-copy')).toBeNull();
  });

  it('copies the untruncated value when the text was shortened', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const host = await render(truncatedField(), 'abcdef0123456789');
    // What the cell shows is the short form...
    expect(host.textContent?.trim()).toBe('abcdef01…');

    const button = host.querySelector('button.crud-copy') as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    await tick();

    // ...but the clipboard gets everything, which is what the filter needs.
    expect(writeText).toHaveBeenCalledWith('abcdef0123456789');
  });

  it('renders a tag cell with the variant as its color', async () => {
    const host = await render(resolveField({ render: 'tag', variantMap: { published: 'green' } }), 'published');
    expect(host.querySelector('nz-tag')?.textContent?.trim()).toBe('published');
    expect(host.querySelector('.ant-tag-green')).not.toBeNull();
  });

  it('renders a badge cell whose variant is a valid zorro status', async () => {
    const host = await render(resolveField({ render: 'badge', variantMap: { published: 'success' } }), 'published');
    expect(host.querySelector('nz-badge')?.textContent?.trim()).toBe('published');
    expect(host.querySelector('.ant-badge-status-success')).not.toBeNull();
  });

  it('degrades an unknown variant to the default badge status', async () => {
    const host = await render(resolveField({ render: 'badge', variantMap: { published: 'green' } }), 'published');
    expect(host.querySelector('.ant-badge-status-default')).not.toBeNull();
  });

  it('renders a dot cell without repeating the text', async () => {
    const host = await render(resolveField({ render: 'dot', variantMap: { published: 'error' } }), 'published');
    expect(host.querySelector('.ant-badge-status-error')).not.toBeNull();
    expect(host.textContent?.trim()).toBe('');
  });

  it('renders an absent value as empty text', async () => {
    const host = await render(resolveField({ render: 'tag', variantMap: { published: 'green' } }), null);
    expect(host.querySelector('nz-tag')?.textContent?.trim()).toBe('');
  });
});
