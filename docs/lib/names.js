// Gör om ett namn till en nyckel. Exakt samma regler används av admin-verktyget
// (när lapparna skapas) och av sidan (när någon skriver sitt namn), så att
// "åsa  ÖBERG", "Asa Oberg" och "Åsa Öberg" alla ger samma nyckel.
//
// Reglerna: små bokstäver, accenter och prickar tas bort (å, ä, ö blir a, a, o),
// och allt som inte är bokstäver eller siffror (mellanslag, bindestreck, punkt)
// räknas som ett mellanrum. "Anna-Lena" och "Anna Lena" blir alltså samma sak.

const EXTRA = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ł: 'l' };

export function nameTokens(input) {
  const s = String(input ?? '')
    .toLocaleLowerCase('sv')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[øæœßđðþł]/g, (c) => EXTRA[c]);
  return s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Nyckeln för ett namn, t.ex. "Åsa Öberg-Ek" -> "asa oberg ek". Tom sträng om namnet saknar bokstäver. */
export function nameKey(input) {
  return nameTokens(input).join(' ');
}

/**
 * Nycklar att prova för det någon skrivit, i ordning:
 * 1. hela namnet
 * 2. bara förnamn + efternamn, om personen skrivit mellannamn
 */
export function nameCandidates(input) {
  const t = nameTokens(input);
  if (t.length === 0) return [];
  const out = [t.join(' ')];
  if (t.length > 2) out.push(`${t[0]} ${t[t.length - 1]}`);
  return out;
}
