# Serverns ändringslogg

Nyast överst. Varje rad som börjar med "- " visas i admin-sidan under "Det här ändras".

## 2026.11.10.2
- Härdning: svaren får aldrig tolkas som annan innehållstyp (nosniff) och API-svar sparas inte i webbläsaren

## 2026.11.10.1
- Uppdateringar sköts nu från admin-sidan: servern kollar varje timme, du godkänner, och misslyckade uppdateringar återställs automatiskt
- Krypterade säkerhetskopior (servern ser bara chiffertext)
- Notiser på låsskärmen (Web Push) med valbara typer
- Användarlistan: alla vanliga användare kan hitta varandra
- Härdning: port 80 stängd, bara nyckel-SSH, fail2ban mot skannrar och gissare, skydd i kärnan, IPv6 av
