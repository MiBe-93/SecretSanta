// Inställningar för sidan. Ändra här (inga hemligheter - filen är publik).
export const CONFIG = {
  // Visas som sidans titel i webbläsarfliken.
  title: 'Familjens Secret Santa',
  // Året som visas i rubriken ("Secret santa 2026").
  year: 2026,
  // Visas när någon inte hittar sitt namn ("Hittar du inte dig? Fråga ...").
  adminName: 'Mikael',
  // Antal PBKDF2-iterationer som admin-verktyget använder vid nästa lottning.
  // Högre = säkrare men långsammare för alla att öppna sin lapp.
  // Värdet står i varje fil, så ändringen påverkar bara nya lottningar.
  iterations: 1_000_000,
};
