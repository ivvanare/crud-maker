# crud-maker

CRUD screens for Angular from one JSON-shaped config. Declare an entity — fields, views, filters,
sorting, validation, actions — and get a validated schema, signal-backed list state and an engine
that talks to any backend through a small transport interface.

Two packages, one direction: **the adapter depends on the core, never the reverse.**

| Package | What it is |
|---------|-----------|
| [`ng-crud-maker`](projects/crud-maker/README.md) | the whole engine: config, state, controller, transport, cell views. **No UI dependency.** |
| [`ng-crud-maker-zorro`](projects/crud-maker-zorro/README.md) | ng-zorro-antd screens: `crud-cell`, `crud-table`, `crud-form`, `crud-detail`. |

## Status

**Not on npm yet.** The code is published here while it stabilises; `pnpm add ng-crud-maker` will
fail with a 404 until the first release. Until then, consume it from this repository:

```bash
git clone https://github.com/ivvanare/crud-maker.git ../crud-maker
cd ../crud-maker && pnpm install && pnpm exec ng build crud-maker
```

and link the built package from your workspace:

```json
{ "dependencies": { "ng-crud-maker": "link:../crud-maker/dist/crud-maker" } }
```

Rebuild this repository after every change to it — the link points at `dist/`, not at the source.

A git dependency (a tag or a branch) is **not** a supported install path while `dist/` stays
untracked: `pnpm` validates a `&path:` subdirectory against the checkout itself, and the built
packages do not exist there. `projects/crud-maker` cannot be installed either — its manifest
declares no entry points, because ng-packagr writes the publishable one into `dist/`. Consume the
packages by linking the built output, as above, until the first npm release.

## Install (once released)

The install **is** the choice — there is no runtime flag to configure:

```bash
# logic only, you render with your own components
pnpm add ng-crud-maker

# the same engine plus ng-zorro screens
pnpm add ng-crud-maker ng-crud-maker-zorro ng-zorro-antd
```

A "manual" UI is not a package: it is `ng-crud-maker` alone, with the cell hints and validators still
doing their job as data. A PrimeNG adapter would be additive — a new package on the same contract,
never a change to the core.

## Quick example

```ts
import { CrudController, defineCrudConfig } from 'ng-crud-maker';

export const faqsConfig = defineCrudConfig({
  key: 'faqs',
  endpoint: 'faqs',
  titleField: 'question',
  fields: [
    { name: 'question', required: true, filters: ['like'] },
    { name: 'answer', type: 'textarea' },
    { name: 'status', cell: { render: 'badge', variantMap: { published: 'success' } } },
    { name: 'createdAt', type: 'datetime', formatter: 'date', defaultSort: 'desc', in: { form: false } },
  ],
});
```

```html
<crud-table [config]="config" [controller]="crud" (edit)="openForm($event)" (remove)="confirm($event)" />
<crud-form [config]="config" [controller]="crud" [value]="editing()" (saved)="close()" />
<crud-detail [config]="config" [value]="row()" />
```

See each package README for the config reference, the registry, the transport contract and the
adapter rules.

## Development

The workspace resolves both packages through `tsconfig` paths to `dist/`, so build in dependency
order — always:

```bash
pnpm install
pnpm exec ng build crud-maker            # the adapter imports the core, so it must exist first
pnpm exec ng test crud-maker --watch=false
pnpm exec ng build crud-maker-zorro
pnpm exec ng test crud-maker-zorro --watch=false
```

`pnpm build` and `pnpm test` run both in that order. Tests need no browser and no API: vitest with
jsdom, fakes for the transport.

## Release

Publishing is a tag, and the tag must match both package versions:

```bash
# bump both package.json files to the same version, commit, then
git tag v0.1.0 && git push origin v0.1.0
```

`publish.yml` builds, refuses to continue when the tag and the package versions disagree, and
publishes both packages with provenance. It needs an `NPM_TOKEN` repository secret with publish
rights.

## License

MIT
