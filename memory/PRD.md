# Marsol Group İdarəetmə Sistemi (MMS) — PRD

## Haqqında
Marsol Group — 500+ üzvü olan B2B netvörkinq şirkətidir. Sahibkarları görüşlərdə bir araya gətirir.

## Paketlər & Kvotalar
| Paket | Dəvət sayı (illik) |
|-------|-------------------|
| Premium | 12 |
| Business | 15 |
| Business+ | 25 |
| Sponsor | 40 |

## Texnoloji Stek
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, Axios
- **Backend**: FastAPI, PyMongo (Motor), JWT Auth
- **Database**: MongoDB

## Modul Statusları

### Hazır Modullar
| # | Modul | Status |
|---|-------|--------|
| 1 | Şirkət Məlumatları | Tam ✅ |
| 2 | İnsan Resursları (7 tab) | Tam ✅ |
| 3 | Satış (pipeline) | Tam ✅ |
| 4 | Maliyyə | Tam ✅ |
| 5 | Görüşlər | Tam ✅ |
| 6 | Tapşırıqlar | Tam ✅ |
| 7 | Mesajlar | Tam ✅ |
| 8 | Tənzimləmələr (10 tab) | Tam ✅ |
| 9 | Bildirişlər | Tam ✅ |
| 10 | **Təşkilatçılıq** | Tam ✅ (2026-04-10) |
| 11 | **Öhdəliklər (kvota dashboard)** | Tam ✅ (2026-04-10) |
| 12 | **Öhdəlik Tarixçəsi** | Tam ✅ (2026-04-10) |
| 13 | **Dəvətlər** | Tam ✅ (2026-04-10) |
| 14 | Üzvlər | Tam ✅ |

### Placeholder Modullar (ComingSoon)
- Şirkət bazası, Üzvlük forumu, Təkliflər
- Marketinq, Layihələr, Hesabatlar, İclas, Fayllar, Qeydlər

## Menyu Strukturu
1. İdarə Paneli
2. Şirkət Məlumatları
3. İnsan Resursları
4. **Satış** (genişlənən, 7 alt kateqoriya):
   - Şirkət bazası, Üzvlər, Öhdəliklər, Öhdəlik tarixçəsi, Üzvlük forumu, Təkliflər, Dəvətlər
5. Marketinq
6. Layihələr
7. Təşkilatçılıq
8. Maliyyə
9. Hesabatlar
10. Görüşlər
11. İclas
12. Tapşırıqlar
13. Mesajlar
14. Fayllar
15. Qeydlər
---
- Bildirişlər / Tənzimləmələr

## Əsas İş Axını (2026-04-10)
1. **Təşkilatçılıq**: Fəaliyyət yarat (növ, tarix, məkan, limit, ev sahibi)
2. **Avto-təklif**: Say daxil et → sistem prioritetə görə şirkət təklif edir
3. **Dəvət**: Siyahını redaktə et, şirkətləri əvəz et, toplu dəvət et
4. **Zəng**: Gözləyir → Cavab verdi (Qatılır/Qatılmır) / Cavab vermədi
5. **Öhdəlik**: Cavab verildikdə -1 kvota düşür (qatılmasa da)
6. **Dashboard**: Prioritet sistemi — az dəvət olunanlar, yaxın bitmə tarixli olanlar vurğulanır

## API Endpoint-lər
- `/api/events` — CRUD
- `/api/invitations` — CRUD, bulk create
- `/api/invitations/{id}/call` — zəng statusu
- `/api/events/{id}/auto-suggest` — avto-təklif
- `/api/obligations/dashboard` — kvota icmalı
- `/api/obligations/company/{id}` — şirkət detalları

## Backlog

### P0
- [ ] Xüsusi sahələr (Custom Fields) tab-spesifik — testing pending

### P1
- [ ] Davamiyyət modulu
- [ ] Barter əməliyyatları

### P2
- [ ] Excel import, PDF hesabatlar, RBAC
- [ ] Placeholder modulların tam qurulması
