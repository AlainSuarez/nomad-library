# Contributing to Nomad Library

Thanks for wanting to help. Nomad Library is run by one person ([Nomad Over Normal](https://www.youtube.com/@NomadOverNormal)), so small, focused changes get reviewed fastest.

Use whatever tools you like. You don't need Claude or any AI tool to contribute. `CLAUDE.md` is just a set of notes for people who happen to use one.

## Reporting a problem

[Open an issue](https://github.com/Chrisgpresents/nomad-library/issues/new/choose) and pick the form that fits. For a library that doesn't work, include your library's catalog link (the page where you search for books). Search the open issues first, and add a thumbs-up to an existing one instead of opening a copy. That's how we tell what matters most.

## Sending a change

1. Fork the repo and make a branch.
2. Set it up with the steps in the [README](README.md#run-it-on-your-computer).
3. Make your change. Keep each pull request to one fix or one feature.
4. Run `npm test` (it needs Google Chrome). Add a test when you fix a bug, so it can't come back.
5. Open a pull request and say what it fixes (link the issue, e.g. `Fixes #12`), how you tested it, and include a screenshot if anything on screen changed.

Every pull request runs the tests automatically. The maintainer reads every change before anything goes on the live site, and you'll hear back on the pull request either way. If it's merged, you're credited in [CREDITS.md](CREDITS.md) and in GitHub's contributor list.

## What gets accepted

- **Yes:** bug fixes, libraries that don't work, readers for new catalog systems (those go in [nomad-library-data](https://github.com/Chrisgpresents/nomad-library-data)), speed, accessibility, small features that make browsing better.
- **Talk first** (open an issue before you build it): big features, new pages, design changes, anything that adds a service or a cost.
- **No:** ads, tracking, analytics scripts, selling or sharing anyone's data, anything that pulls from a library faster than its servers allow or gets around a block a library has put up.

## House rules for the code

- Plain HTML, CSS and JavaScript. No framework and no build step.
- Every link that leaves the site needs `rel="noopener noreferrer"`. Some libraries refuse visitors whose browser says they came from here.
- Wording on the site is short and plain, with no em dashes.
- Keep the look: Poppins, rectangles with slightly rounded (4px) corners, no gradients or decorations.
- The server runs on Cloudflare's free-tier-sized limits. Heavy work belongs in the browser or in the copier, not in `functions/`.
- Never commit keys or passwords. Local secrets go in `.dev.vars`, which git ignores.

## License

By sending a pull request you agree that your contribution is licensed under the [GNU AGPL v3](LICENSE), like the rest of the project.
