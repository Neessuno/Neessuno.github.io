# Portfolio — Matteo Capitano

Sito statico (HTML + CSS + JS, nessun build). Apri `index.html` o servilo con:

    python3 -m http.server 8080

## Aggiungere foto/video dei progetti
Metti i file in `assets/projects/` e, in `index.html`, sostituisci il contenuto di ogni
`<div class="media" data-placeholder>` con:

    <div class="media"><img src="assets/projects/01.jpg" alt="Cella di pallettizzazione"></div>
    <div class="media"><video src="assets/projects/01.mp4" autoplay muted loop playsinline></video></div>

## Testi bilingui
Ogni testo ha due versioni: `<span class="l-it">…</span><span class="l-en">…</span>`.

## Pubblicare su GitHub Pages
1. Crea un repo (es. `matteocapitano.github.io`) e carica questa cartella.
2. Settings → Pages → Deploy from branch → `main` / root.
