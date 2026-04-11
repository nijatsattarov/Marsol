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
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, Axios, Recharts
- **Backend**: FastAPI, PyMongo (Motor), JWT Auth
- **Database**: MongoDB

## Modul Statusları

### Hazır Modullar
| # | Modul | Status |
|---|-------|--------|
| 1 | İdarə Paneli (+ fəaliyyət/dəvət statistikası) | Tam ✅ |
| 2 | Şirkət Məlumatları | Tam ✅ |
| 3 | İnsan Resursları (7 tab) | Tam ✅ |
| 4 | Satış (pipeline) | Tam ✅ |
| 5 | Təşkilatçılıq (event planning + auto-suggest + sektor filtr) | Tam ✅ |
| 6 | Öhdəliklər (kvota dashboard, dinamik paketdən oxuyur) | Tam ✅ |
| 7 | Öhdəlik Tarixçəsi (filtrlərlə: növ, tarix, status) | Tam ✅ |
| 8 | Dəvətlər (zəng takibi + WhatsApp wa.me) | Tam ✅ |
| 9 | Üzvlər | Tam ✅ |
| 10 | Maliyyə | Tam ✅ |
| 11 | Görüşlər | Tam ✅ |
| 12 | Tapşırıqlar | Tam ✅ |
| 13 | Mesajlar | Tam ✅ |
| 14 | Tənzimləmələr (10 tab + paketdə dəvət sayı) | Tam ✅ |
| 15 | Bildirişlər | Tam ✅ |

### Placeholder Modullar (ComingSoon)
- Şirkət bazası, Üzvlük forumu, Təkliflər
- Marketinq, Layihələr, Hesabatlar, İclas, Fayllar, Qeydlər

## Əsas İş Axını
1. **Təşkilatçılıq**: Fəaliyyət yarat (növ, tarix, məkan, limit, Google Maps link, ev sahibi)
2. **Avto-təklif**: Say daxil et → sistem prioritetə görə şirkət təklif edir (sektor toqquşması nəzərə alınır)
3. **Dəvət**: Siyahı redaktəsi, manual əlavə (sektor xəbərdarlığı), toplu dəvət
4. **WhatsApp**: wa.me linki ilə dəvət göndər (sahibkar nömrəsi, şirkət nömrəsi, xüsusi nömrə)
5. **Zəng**: Gözləyir → Cavab verdi (Qatılır/Qatılmır) / Cavab vermədi
6. **Öhdəlik**: Cavab verildikdə -1 kvota düşür (kvota paketdən dinamik oxunur)
7. **Dashboard**: Fəaliyyət + dəvət statistikası (növ üzrə breakdown, bar chart)

## API Endpoint-lər
- `/api/events` — CRUD + `/api/events/{id}/auto-suggest` + `/api/events/{id}/check-sector-conflict`
- `/api/invitations` — CRUD, bulk, `/api/invitations/{id}/call`
- `/api/obligations/dashboard`, `/api/obligations/company/{id}`
- `/api/dashboard/stats` — events + invitations breakdown
- `/api/settings/packages` — invitation_count ilə

## Backlog

### P0
- [ ] Xüsusi sahələr (Custom Fields) tab-spesifik — testing pending

### P1
- [ ] Davamiyyət modulu
- [ ] Barter əməliyyatları

### P2
- [ ] Excel import, PDF hesabatlar, RBAC
- [ ] Placeholder modulların funksionallığı
