# Star History Assets

Generate static light and dark GitHub star-history charts for README files. The scheduled workflow authenticates with its short-lived `GITHUB_TOKEN`; consumers only load generated WebP files and never need a token.

The chart renderer is adapted from [star-history/star-history](https://github.com/star-history/star-history). GitHub data is fetched with exact pagination, rendered through Star History's D3/SVG chart implementation, and converted to WebP with `sharp`. The Star History web server, token pool, and cache service are not included.

## Add a repository

Add an entry to `config/repos.json`:

```json
{
  "repository": "MAA1999/M9A",
  "slug": "MAA1999-M9A"
}
```

Run the **Update star history assets** workflow manually, or wait for its daily schedule. Generated files are written to:

```text
generated/MAA1999-M9A/light.webp
generated/MAA1999-M9A/dark.webp
```

## Configure the GitHub API token

The workflow runs in a separate repository, so its automatic `GITHUB_TOKEN` cannot read the M9A Stargazers API. Anonymous access to that endpoint is also unavailable. Add a repository secret named `STAR_HISTORY_TOKEN` before running the workflow.

Use a fine-grained personal access token with:

- Resource owner: `MAA1999`
- Repository access: only `M9A`
- Repository permissions: `Metadata` read-only

Then add it to this repository:

```bash
gh secret set STAR_HISTORY_TOKEN --repo MAA1999/star-history-assets
```

The token is used only for reading public Stargazer timestamps. Commits to this asset repository continue to use its short-lived automatic `GITHUB_TOKEN` through `contents: write`.

## Embed a chart

Assuming this repository is published as `MAA1999/star-history-assets`:

```html
<a href="https://github.com/MAA1999/M9A/stargazers">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://raw.githubusercontent.com/MAA1999/star-history-assets/main/generated/MAA1999-M9A/dark.webp"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://raw.githubusercontent.com/MAA1999/star-history-assets/main/generated/MAA1999-M9A/light.webp"
    />
    <img
      alt="MAA1999/M9A Star History"
      src="https://raw.githubusercontent.com/MAA1999/star-history-assets/main/generated/MAA1999-M9A/light.webp"
      width="700"
    />
  </picture>
</a>
```

## Local development

```bash
pnpm install --frozen-lockfile
GH_TOKEN=github_token pnpm generate
pnpm check
```

To render charts from existing cached API data without network access:

```bash
pnpm generate -- --from-cache
```

The generator stores only stargazer timestamps in `data/`. This makes chart generation reproducible and keeps GitHub API access out of README rendering.

## Attribution

The vendored chart renderer is based on Star History commit `bcddc9d532b10bac7e0187a741288bf9cab17616`, licensed under the MIT License. See `THIRD_PARTY_NOTICES.md` and `licenses/star-history-MIT.txt`.

## License

This project is licensed under the MIT License. Vendored Star History code retains its original copyright and MIT license notice.
