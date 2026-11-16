// Inställningar för sidan. Ändra här (inga hemligheter - filen är publik).
export const CONFIG = {
  // Visas som rubrik på sidan.
  title: 'Släktens Secret Santa',
  // Visas vid "Glömt koden? Fråga ...".
  adminName: 'Mikael',
  // Antal PBKDF2-iterationer som admin-verktyget använder vid nästa lottning.
  // Högre = säkrare men långsammare för alla att öppna sin lapp.
  // Värdet står i varje fil, så ändringen påverkar bara nya lottningar.
  iterations: 1_000_000,
};
