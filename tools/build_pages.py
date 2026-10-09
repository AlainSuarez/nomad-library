#!/usr/bin/env python3
"""Writes the plain pages (privacy, terms, accessibility) with the site's header and footer."""
import os
ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
UPDATED = "October 9, 2026"
CONTACT = 'through the <a href="https://www.youtube.com/@NomadOverNormal/about" target="_blank" rel="noopener">Nomad Over Normal YouTube channel</a>'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · Nomad Library</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#F2E7CD" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10232B" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/fav-64.png" sizes="64x64">
<link rel="apple-touch-icon" href="/icons/apple-touch.png">
<link rel="preload" href="/fonts/poppins-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/" aria-label="Nomad Library home">
    <img src="/icons/fav-64.png" alt="" width="32" height="32">
    <span>Nomad Library</span>
  </a>
  <nav class="nav">
    <a class="navlink" href="https://www.youtube.com/@NomadOverNormal" target="_blank" rel="noopener">YouTube</a>
    <a class="navlink" href="https://venmo.com/u/chrisgpresents" target="_blank" rel="noopener">Donate</a>
  </nav>
</header>
<main id="main" class="doc">
<h1>{title}</h1>
<p class="updated">Last updated {updated}</p>
"""
FOOT = """</main>
<footer class="foot">
  <p class="credit"><a href="https://www.youtube.com/@NomadOverNormal" target="_blank" rel="noopener">Website designed by Nomad Over Normal <svg class="yt" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#FF0000"/><path d="M11.2 5.8v8.4L18.4 10z" fill="#fff"/></svg></a></p>
  <p class="legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/accessibility">Accessibility</a><a href="https://venmo.com/u/chrisgpresents" target="_blank" rel="noopener">Tip on Venmo</a></p>
</footer>
</body>
</html>
"""

PRIVACY = f"""
<div class="summary">
<p><b>The short version</b></p>
<ul>
<li>We never ask for your name, email, phone number or a password.</li>
<li>There are no ads, no analytics and no tracking of any kind.</li>
<li>We don't sell or share anything with anyone.</li>
<li>You can use the whole site without an account. Then nothing about you is stored on our servers.</li>
<li>If you make an account, we keep only your library, favorites, watchlist and settings, so they follow you to other devices. You can delete all of it in one tap.</li>
</ul>
</div>

<h2>If you don't make an account</h2>
<p>Your library choice, favorites and settings are saved in your own browser's storage on your device. They never reach our servers. Clearing your browser's data removes them.</p>

<h2>If you make an account</h2>
<p>Accounts use passkeys, which means you sign in with your face, fingerprint or device PIN. Your face and fingerprint never leave your device, and we never see them. Here's everything we store for an account:</p>
<ul>
<li>A random account number.</li>
<li>Your passkey's public key, which lets us check that it's you. It can't be used to sign in anywhere else.</li>
<li>A scrambled copy of your backup code. We can't read the original.</li>
<li>The library you picked, your favorites, your imported watchlist titles and your display settings.</li>
<li>The dates your account was made and last updated.</li>
</ul>
<p>That's it. There's no email, name, location or payment information attached to an account.</p>

<h2>Deleting your data</h2>
<p>Open <b>Account</b> and choose <b>Delete my account</b>. Everything above is erased right away and can't be recovered. Signing out leaves a copy of your shelf on that device until you clear your browser's data.</p>

<h2>Cookies</h2>
<p>Nomad Library uses 1 cookie, and only if you sign in. It keeps you signed in on that device. While you're signing in, a second short-lived cookie holds the security check and expires within 10 minutes. There are no advertising, analytics or tracking cookies.</p>

<h2>Your watchlist file</h2>
<p>When you import an IMDb or Letterboxd watchlist, the file is read inside your browser. Only the movie titles and years are sent to look them up at your library. The file itself is never uploaded. If you're signed in, the titles and matches are saved to your account so they show up on your other devices.</p>

<h2>Other services the site talks to</h2>
<ul>
<li><b>Your library's catalog.</b> Searches go through our server to the library's catalog service (BiblioCommons), so the library sees our server's request, not you.</li>
<li><b>Cover images</b> load straight from the cover service your library uses, the same way they do on the library's own website.</li>
<li><b>Trailers, IMDb, holds and tips.</b> The Trailer, IMDb, Place a hold and Donate buttons open YouTube, IMDb, your library's website or Venmo. Those sites have their own privacy policies.</li>
<li><b>Hosting.</b> The site runs on Cloudflare. Like any web host, Cloudflare handles your IP address to deliver pages and block attacks. We don't use it to identify or follow anyone.</li>
</ul>

<h2>Kids</h2>
<p>Nomad Library isn't aimed at children under 13, and it doesn't collect personal information from anyone.</p>

<h2>Changes</h2>
<p>If this policy changes, the new version goes on this page with a new date at the top.</p>

<h2>Questions</h2>
<p>Reach out {CONTACT}.</p>
"""

TERMS = f"""
<div class="summary">
<p><b>The short version</b></p>
<ul>
<li>Nomad Library is free. There's nothing to buy and no subscription.</li>
<li>It shows what's at your public library. Borrowing still happens with your library card, under your library's rules.</li>
<li>It's offered as is, by one person, with no guarantees.</li>
</ul>
</div>

<h2>What Nomad Library is</h2>
<p>Nomad Library is a free website made by Nomad Over Normal that shows the DVDs and Blu-rays in a public library's online catalog in an easier way to browse. It isn't made by, endorsed by or affiliated with any library, BiblioCommons, IMDb, Letterboxd or YouTube.</p>

<h2>Library information</h2>
<p>Titles, covers and availability come live from each library's public catalog, and they belong to that library and its providers. What's on the shelf can change at any moment, so always confirm with your library before you make the trip. Holds, checkouts, due dates and fines are between you and your library.</p>

<h2>Ratings and trailers</h2>
<p>Ratings come from IMDb's public datasets and are matched to library titles automatically, so now and then a match will be wrong. Trailers are found with a YouTube search and may not always be the right video.</p>

<h2>Your account</h2>
<p>Accounts are free and optional. Keep your backup code somewhere safe. Without it or one of your passkeys, there's no way to get back into an account, because we don't keep an email to reset it with. Please don't use the site to overload library systems, scrape it in bulk or try to get into other people's accounts. Accounts used that way may be removed.</p>

<h2>Tips</h2>
<p>The Donate link is an optional tip to help cover running the site. Tips aren't payment for anything, they don't unlock features and they aren't refundable.</p>

<h2>No guarantees</h2>
<p>Nomad Library is provided as is, without warranties of any kind. It may change, go down or shut off. To the fullest extent the law allows, Nomad Over Normal isn't liable for any loss that comes from using the site or relying on its information.</p>

<h2>Changes</h2>
<p>These terms may be updated. The new version goes on this page with a new date at the top, and using the site after that means you accept it. These terms are governed by the laws of New Jersey, USA.</p>

<h2>Questions</h2>
<p>Reach out {CONTACT}.</p>
"""

A11Y = f"""
<p>Nomad Library should work for everyone, including people who use a screen reader, a keyboard, zoom or other assistive tools. The goal is to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>

<h2>What's built in</h2>
<ul>
<li>Everything works with a keyboard, with a visible outline showing where you are, and a Skip to content link.</li>
<li>Every button and form field has a label a screen reader can announce.</li>
<li>Each movie's title, year, format and availability are written out as text, not just shown on the cover.</li>
<li>Text and buttons meet AA color contrast in both light and dark mode, and the site follows your device's light or dark setting.</li>
<li>Pages reflow on phones and stay usable at 200% zoom.</li>
<li>Motion is kept to a minimum and turns off if your device asks for reduced motion.</li>
<li>Signing in uses your device's own face, fingerprint or PIN prompt, which works with your device's accessibility settings. A backup code works for anyone who can't use passkeys.</li>
</ul>

<h2>Known limits</h2>
<ul>
<li>Cover images come from each library and don't include descriptions, so they're skipped by screen readers. The title is always written under every cover.</li>
<li>Pages we link to, like your library's catalog, YouTube and IMDb, have their own accessibility.</li>
</ul>

<h2>Tell us what's not working</h2>
<p>If something on Nomad Library is hard to use, please reach out {CONTACT} and say what you were trying to do and what device or tool you were using. Accessibility fixes go to the front of the line.</p>
"""

for slug, title, desc, body in [
    ("privacy", "Privacy Policy", "What Nomad Library stores (very little) and what it never does.", PRIVACY),
    ("terms", "Terms of Use", "The plain-language terms for using Nomad Library.", TERMS),
    ("accessibility", "Accessibility", "How Nomad Library works with screen readers, keyboards and other tools.", A11Y),
]:
    with open(os.path.join(ROOT, f"{slug}.html"), "w") as f:
        f.write(HEAD.format(title=title, desc=desc, updated=UPDATED) + body + FOOT)
print("wrote 3 pages")
