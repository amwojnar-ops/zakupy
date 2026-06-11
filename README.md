# 🛒 Lista zakupów

Prosta, szybka aplikacja webowa do zarządzania listą zakupów dla całej rodziny. Działa w przeglądarce, nie wymaga serwera, dane trzyma lokalnie w urządzeniu.

## Funkcje

- **Autocomplete** — słownik 200+ produktów z podpowiedziami podczas pisania
- **Auto-kategoria** — kategoria ustawia się sama na podstawie nazwy produktu
- **Tryb sklepu** — duże, łatwe do odhaczania kafelki przy wózku, z paskiem postępu
- **Filtry sklepów** — Auchan, Lidl, Biedronka, Inny (z licznikiem)
- **Mój słownik** — możliwość dodania własnych produktów do podpowiedzi
- **Kopiuj listę** — eksport do schowka jako czytelny tekst (np. do wysłania SMSem)
- **Usuń kupione** — jednym przyciskiem wyczyść zaznaczone produkty
- **PWA** — można zainstalować na telefonie jak aplikację ("Dodaj do ekranu głównego")
- **Dark mode** — automatycznie dostosowuje się do ustawień systemu
- **Offline** — działa bez internetu po pierwszym otwarciu (dane w localStorage)

## Struktura plików

```
zakupy/
├── index.html          # Główna strona
├── manifest.json       # Konfiguracja PWA
├── css/
│   └── style.css       # Wszystkie style, dark mode, responsive
└── js/
    ├── data.js         # Kategorie, sklepy, słownik produktów
    ├── autocomplete.js # Logika podpowiedzi i zgadywania kategorii
    ├── storage.js      # Zapis/odczyt localStorage, eksport
    └── app.js          # Główna logika UI i renderowanie
```

## Uruchomienie

Aplikacja korzysta z ES Modules, więc wymaga serwera HTTP (nie otworzy się przez `file://`).

### Lokalnie

```bash
# Python (wbudowany)
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
# Zainstaluj rozszerzenie "Live Server" i kliknij "Go Live"
```

Następnie otwórz `http://localhost:8080` w przeglądarce.

### GitHub Pages

1. Wgraj repozytorium na GitHub
2. Wejdź w **Settings → Pages**
3. Wybierz branch `main`, folder `/` (root)
4. Aplikacja będzie dostępna pod `https://<twój-login>.github.io/<nazwa-repo>/`

## Dodawanie własnych produktów do słownika

W widoku listy kliknij przycisk **Słownik** — możesz dodać własne produkty z przypisaną kategorią. Zostaną zapamiętane w urządzeniu i będą pojawiać się jako pierwsze w podpowiedziach.

## Dodawanie sklepów

Otwórz `js/data.js` i dodaj wpis do tablicy `STORES`:

```js
{ id: 'kaufland', label: 'Kaufland', dot: '#E24B4A', bg: '#FCEBEB', fg: '#A32D2D' },
```

## Ikony PWA

Umieść pliki `icons/icon-192.png` i `icons/icon-512.png` — ikony aplikacji po instalacji na telefonie. Możesz wygenerować je np. na [realfavicongenerator.net](https://realfavicongenerator.net).

## Technologie

- Czysty HTML + CSS + JavaScript (ES Modules, bez bundlera)
- [Tabler Icons](https://tabler-icons.io/) — ikony
- [Inter](https://fonts.google.com/specimen/Inter) — czcionka
- localStorage — przechowywanie danych
