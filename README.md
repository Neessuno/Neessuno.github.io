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

## CV in PDF
Il sorgente è `cv/cv.html` (senza telefono né data di nascita). Per rigenerare il PDF con il server locale attivo:

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
      --print-to-pdf=assets/Matteo-Capitano-CV.pdf http://localhost:8080/cv/cv.html

## Dopo ogni modifica a CSS/JS
Aggiorna il numero `?v=` di `styles.css`, `main.js` e `cobot.js` in `index.html`, così i browser non usano la cache.
