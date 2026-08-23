# 🌐 Growtopia Sprite Explorer & Studio - Development Notes

> **Tanggal Catatan**: 30 Juli 2026  
> **Versi Game**: Growtopia v26 (16,304 Items Database)  
> **Lokasi Project**: `C:\Users\VICTUS\Downloads\growtopia-explorer`

---

## 📌 Status Project & Catatan Pengembangan (Dev Notes)

### 1. Structure & Database Files
- `public/items_db.json`: Database utama 16.304 item hasil parsing `items.dat` v26.
  - Bidang kunci: `id`, `name`, `texture`, `tx`, `ty`, `category`, `action`, `has_anim`, `frames`.
  - `has_anim: true` **HANYA** untuk 1.640 item yang memiliki frame animasi sekuens sejati (`spread > 1` atau `stripe > 1`).
- `public/tilesheets_info.json`: Katalog 852 file PNG mentahan tilesheets.
- `public/audio_db.json`: Katalog 558 efek suara (.wav/.ogg).
- `public/tilesheets/`: Folder berisi 852 file PNG mentahan tilesheets.
- `public/audio/`: Folder berisi 558 file suara WAV/OGG.

---

### 2. Catatan Khusus GT Set Planner (Avatar Dress-Up Engine)
- **Status**: Perlu penyempurnaan alur koordinat & penumpukan layer.
- **Konsep Engine**:
  - Di Growtopia, sprite item (baju, celana, sepatu, topi, sayap) masing-masing adalah ubin 32x32px yang didesain dengan offset piksel bawaan di dalam gambar tilesheet.
  - **Urutan Penumpukan Layer (*Type Order*)**:
    1. `Back` (Wings, Capes)
    2. `Base Player Body` (Kulit & Mannequin)
    3. `Facial Expression` (Mata / Ekspresi)
    4. `Feet` (Sepatu, Boots)
    5. `Pants` (Celana, Rok)
    6. `Shirt` (Kemeja, Jaket)
    7. `Chest` (Zirah / Rompi)
    8. `Face` (Kacamata, Topeng)
    9. `Hair` (Rambut)
    10. `Hat` (Topi, Mahkota)
    11. `Hand` (Senjata, Alat)
- **Tips Kelanjutan**:
  - Untuk penyesuaian sprite tubuh & kepala, pastikan ubin `player_cosmetics1.png` dan ubin pakaian digambar tepat di koordinat asal `(0, 0)` pada canvas 32x32px sebelum discale ke canvas 128x128px.

---

## 🚀 Cara Menjalankan Server Lokal

```bash
python server.py
```
Akses di browser: `http://localhost:5000`
