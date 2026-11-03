# Fearless Demos

Fearless Demos is a website that lists demos written in Fearless.
A demo is an app or a library.
Each demo is one zip with a URL that the visitor copies, to import the URL with the Fearless manager.
The website is plain html, css and Javascript.
The website uses no framework, no build tool and no web font.
The website loads no script or style from any other site.
The only request to another site is the picture that a demo names in its field `image`.

## Layout of the repository

- `demos/<id>.json`: one file per demo.
- `site/`: `index.html`, `styles.css`, `app.js` and `favicon.svg`.
- `.github/workflows/pages.yml`: validates the demos, builds the website and deploys the website to GitHub Pages.

Adding a file to `demos/` is the only step that makes the website list a new demo.

## Demo file

Example of a demo file:

```
{
  "title": "Lights Out",
  "summary": "One or two sentences.",
  "rank": "app999",
  "tags": ["game", "puzzle", "gui"],
  "download": "https://example.org/lights_out/lights_out_app.zip",
  "page": "https://example.org/lights_out/",
  "image": "https://example.org/lights_out/picture.png"
}
```

| field | required | content |
| --- | --- | --- |
| `title` | yes | The name of the demo, as non-empty text. |
| `summary` | yes | One or two sentences, as non-empty text. |
| `rank` | yes | One of `base`, `core`, `driver`, `worker`, `framework`, `accumulator`, `tool`, `app`, followed by exactly three digits. |
| `tags` | yes | A non-empty list of different tags. |
| `download` | yes | The https URL of the zip. The button Copy URL of the card copies this URL. |
| `page` | no | An https URL of a page about the demo. |
| `image` | no | An https URL of a picture shown on the card of the demo. |

A file with any other field is rejected.

The name of the file is the id of the demo followed by `.json`.
An id has lowercase letters, digits and underscores, and starts with a letter.

A tag has lowercase letters, digits and single spaces, for example `game engine`.

## Ranks

The eight rank names are ordered `base` < `core` < `driver` < `worker` < `framework` < `accumulator` < `tool` < `app`.
A library is used by code of a higher rank.
A demo with a rank that starts with `app` is an app, a program.
A demo with any other rank is a library.

## Names of zips

The file name of the zip in `download` decides the kind of the zip.

| rank | the file name of the zip ends with |
| --- | --- |
| `app` and three digits | `_app.zip` or `_edu_app.zip` |
| any other name and three digits | `_lib.zip` or `_edu_lib.zip` |

The part `_edu_` marks a demo designed to teach programming in Fearless.
The website shows the badge `App` or `Library` from the rank.
The website shows the badge `Educational` when the file name of the zip has `_edu_`.
The JSON file has no field for the badges.

## How the website is deployed

The workflow `Pages` runs on a push to `main`, on a pull request and on a manual run.

The job `build` runs on every trigger.
The job `build` checks every file in `demos/` with `jq`.
The job `build` fails and names the file and the broken rule when a file is broken or when two files have the same `download`.
The job `build` copies `site/` into `_site/` and generates `_site/demos.json`.
The file `demos.json` is a JSON array of all demos sorted by id, where each demo has its fields and an extra field `id`.
The file `demos.json` is generated at each run and is never committed.
The job `build` then uploads `_site/` as the Pages artifact.

The job `deploy` runs only on a push to `main` and on a manual run.
The job `deploy` publishes the Pages artifact.
A pull request only validates and builds.

The script `app.js` loads `demos.json` and builds every card with `createElement` and `textContent`.
The script `app.js` accepts only `https:` URLs.
The script `app.js` skips a demo whose `download` is not an https URL, ignores a `page` or an `image` that is not an https URL, and writes each skip to the browser console.

## Preview locally

Install `jq` and a JDK 18 or newer.
From the root of the repository, in a shell with POSIX syntax, run:

```
mkdir _site
cp site/* _site/
jq -n '[inputs | . + {id: (input_filename | sub("^.*/"; "") | sub("\\.json$"; ""))}] | sort_by(.id)' demos/*.json > _site/demos.json
jwebserver -p 8000 -d "$PWD/_site"
```

Open `http://localhost:8000/` in a browser.
The folder `_site/` is ignored by git.
Run `rm -r _site` before the next preview.

## One-time setup by the repository owner

GitHub Pages must publish from GitHub Actions.
Only an owner or an admin of the repository can set this.

1. Open Settings of the repository.
2. Open Pages.
3. Under Build and deployment, set Source to GitHub Actions.

The first deployment happens on the next push to `main`, or when the workflow runs by hand:
open Actions, choose the workflow `Pages`, and press Run workflow.
After the first deployment, the address of the website appears at the top of Settings > Pages.

## Add a demo

1. Create `demos/<id>.json` with the fields above.
2. Open a pull request.
3. The workflow `Pages` validates the file. A broken file fails the job `build` with an error that names the file and the broken rule.
4. After the merge, the next deployment lists the demo.
