# 🛒 Lista zakupów — wersja rodzinna (Firebase)

Wspólna lista zakupów dla całej rodziny. Każda zmiana (dodanie produktu, odhaczenie) jest widoczna u wszystkich w czasie rzeczywistym. Wystarczy otworzyć link w przeglądarce — bez logowania, bez instalacji.

---

## Konfiguracja Firebase (jednorazowo, ~10 minut)

### 1. Utwórz projekt Firebase

1. Wejdź na [console.firebase.google.com](https://console.firebase.google.com)
2. Kliknij **"Dodaj projekt"** (lub "Add project")
3. Wpisz nazwę np. `zakupy-rodzina`
4. Wyłącz Google Analytics (niepotrzebne) → **Utwórz projekt**

### 2. Włącz Realtime Database

1. W lewym menu kliknij **Build → Realtime Database**
2. Kliknij **"Create Database"**
3. Wybierz lokalizację **Europe-west1 (Belgium)** — najbliżej Polski
4. Wybierz tryb **"Start in test mode"** → **Enable**

   > Test mode pozwala na odczyt i zapis bez logowania przez 30 dni.
   > Po tym czasie zmień reguły (patrz krok 5).

### 3. Pobierz dane konfiguracyjne

1. Wejdź w **Project Settings** (ikona ⚙️ obok "Project Overview")
2. Przewiń do sekcji **"Your apps"**
3. Kliknij ikonę `</>` (Web app)
4. Wpisz nazwę aplikacji np. `zakupy-web` → **Register app**
5. Skopiuj obiekt `firebaseConfig` — wygląda tak:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "zakupy-rodzina.firebaseapp.com",
  databaseURL: "https://zakupy-rodzina-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "zakupy-rodzina",
  storageBucket: "zakupy-rodzina.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 4. Wklej konfigurację do projektu

Otwórz plik `js/firebase.js` i zastąp wartości w obiekcie `FIREBASE_CONFIG`:

```js
export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",           // ← Twoje dane
  authDomain:        "zakupy-rodzina.firebaseapp.com",
  databaseURL:       "https://zakupy-rodzina-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "zakupy-rodzina",
  storageBucket:     "zakupy-rodzina.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef",
};
```

### 5. Ustaw reguły bezpieczeństwa (ważne!)

W Firebase Console → **Realtime Database → Rules** wklej:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Kliknij **Publish**. Dzięki temu każdy z linkiem może czytać i pisać — bez logowania.

> ⚠️ Takie reguły są odpowiednie dla prywatnej listy rodzinnej. Nie publikuj linku publicznie.

### 6. Wgraj na GitHub i włącz Pages

```bash
git add .
git commit -m "add firebase integration"
git push
```

Jeśli masz już GitHub Pages włączone, aplikacja zaktualizuje się automatycznie po push.

---

## Jak udostępnić rodzinie

Po wgraniu na GitHub Pages wyślij link:
```
https://amwojnar-ops.github.io/zakupy/
```

Każdy otwiera ten link w przeglądarce — i widzi tę samą listę na żywo.

---

## Instalacja jako aplikacja na telefonie

**Android (Chrome):** menu ⋮ → "Dodaj do ekranu głównego"  
**iPhone (Safari):** przycisk Udostępnij → "Dodaj do ekranu głównego"

---

## Struktura plików

```
zakupy/
├── index.html           # Główna strona
├── manifest.json        # PWA
├── css/style.css        # Style
└── js/
    ├── firebase.js      # ← Tu wklejasz swoją konfigurację Firebase
    ├── data.js          # Kategorie, sklepy, słownik produktów
    ├── autocomplete.js  # Podpowiedzi i auto-kategoria
    ├── storage.js       # Eksport do schowka
    └── app.js           # Logika UI
```

---

## Bezpłatny limit Firebase

Firebase Realtime Database w planie Spark (bezpłatnym) pozwala na:
- **1 GB** przechowywanych danych
- **10 GB/miesiąc** transferu danych

Dla rodzinnej listy zakupów to wielokrotnie więcej niż potrzeba.
