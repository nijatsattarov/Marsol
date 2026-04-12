# Marsol Group İdarəetmə Sistemi (MMS) — PRD

## Haqqında
Marsol Group — 500+ üzvü olan B2B netvörkinq şirkətidir. Sahibkarları görüşlərdə bir araya gətirir.

## Paketlər & Kvotalar (Dinamik — Tənzimləmələrdən idarə olunur)
| Paket | Dəvət sayı (illik) |
|-------|-------------------|
| Premium | 12 |
| Business | 15 |
| Business+ | 25 |
| Sponsor | 40 |

## Texnoloji Stek
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, Axios, Recharts, SheetJS (xlsx)
- **Backend**: FastAPI, PyMongo (Motor), JWT Auth
- **Database**: MongoDB

## Hazır Modullar
| # | Modul | Status |
|---|-------|--------|
| 1 | İdarə Paneli (fəaliyyət/dəvət statistikası) | ✅ |
| 2 | Şirkət Məlumatları (XLSX export) | ✅ |
| 3 | İnsan Resursları (7 tab) | ✅ |
| 4 | Satış (pipeline) | ✅ |
| 5 | Təşkilatçılıq (event + auto-suggest + sektor filtr + WhatsApp + Maps) | ✅ |
| 6 | Öhdəliklər (kvota dashboard + XLSX export) | ✅ |
| 7 | Öhdəlik Tarixçəsi (filtrlərlə) | ✅ |
| 8 | Dəvətlər (zəng takibi + WhatsApp) | ✅ |
| 9 | Üzvlər | ✅ |
| 10 | Maliyyə | ✅ |
| 11 | Görüşlər | ✅ |
| 12 | İclas (Gündəm→Tapşırıq→Məsul şəxs iç-içə, Task sinxronizasiya, Göz ikon, Excel export) | ✅ |
| 13 | Tapşırıqlar (T-XXX ID, select əməkdaş/məsul, Əlaqəli obyekt, user-based filter) | ✅ |
| 13 | Mesajlar | ✅ |
| 14 | Tənzimləmələr (paketdə dəvət sayı) | ✅ |
| 15 | Bildirişlər | ✅ |

### Placeholder Modullar (ComingSoon)
Şirkət bazası, Üzvlük forumu, Təkliflər, Marketinq, Layihələr, Hesabatlar, İclas, Fayllar, Qeydlər

## Backlog
### P0
- [x] Görüşlər modulu tam yenidən yazıldı (CRUD, Filtrlər, Xatırlatmalar, Bildirişlər) — ✅ Test keçdi (Iteration 18)
- [x] Görüşlər formu düzəldildi: "Görüş təyin edən" silindi, "Layihə" select oldu, Bildiriş zəngində xatırlatmalar görünür — ✅
- [ ] Xüsusi sahələr (Custom Fields) tab-spesifik — testing pending

### P1
- [ ] Davamiyyət modulu
- [ ] Barter əməliyyatları

### P2
- [ ] PDF hesabatlar, RBAC
- [ ] Placeholder modulların funksionallığı
