// ============================================================================
//  Banderas de países.
//
//  Mapea el nombre de cada selección (tal cual lo devuelve football-data.org)
//  a su código ISO 3166-1 alfa-2. El componente <Flag> (components/Flag.tsx)
//  usa ese código con la librería "flag-icons" para pintar una bandera SVG que
//  se ve IGUAL en Windows, Mac, móvil, etc. (los emoji de bandera no se ven en
//  Windows, por eso no usamos emoji).
//
//  Inglaterra/Escocia/Gales usan los códigos especiales de flag-icons
//  (gb-eng, gb-sct, gb-wls).
//
//  Si en una fase aparece un equipo nuevo (eliminatorias con nombres que no
//  estén aquí), isoFor() devuelve null y <Flag> no pinta nada (no rompe).
//  Añádelo al mapa.
// ============================================================================

/** nombre de equipo (football-data) -> código de flag-icons (alfa-2 o gb-xxx). */
const TEAM_TO_ISO: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia-H.": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  "Congo DR": "cd",
  Croatia: "hr",
  "Curaçao": "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  "Korea Republic": "kr",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  USA: "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
};

/**
 * Devuelve el código de bandera (flag-icons) de un equipo, o null si no se
 * conoce. El componente <Flag> lo usa para pintar la bandera SVG.
 */
export function isoFor(team: string): string | null {
  return TEAM_TO_ISO[team] ?? null;
}

// ----------------------------------------------------------------------------
//  Nombres de país en español (solo para MOSTRAR).
//
//  La clave es el nombre EN INGLÉS tal cual lo guarda la BD / football-data.
//  En la base de datos seguimos usando los nombres originales (para no romper
//  el casado con la API ni los pronósticos existentes); solo traducimos al
//  pintar en pantalla con esName().
// ----------------------------------------------------------------------------
const TEAM_ES: Record<string, string> = {
  Algeria: "Argelia",
  Argentina: "Argentina",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Bélgica",
  "Bosnia-H.": "Bosnia-H.",
  Brazil: "Brasil",
  Canada: "Canadá",
  "Cape Verde": "Cabo Verde",
  Colombia: "Colombia",
  "Congo DR": "RD Congo",
  Croatia: "Croacia",
  "Curaçao": "Curazao",
  Czechia: "Chequia",
  Ecuador: "Ecuador",
  Egypt: "Egipto",
  England: "Inglaterra",
  France: "Francia",
  Germany: "Alemania",
  Ghana: "Ghana",
  Haiti: "Haití",
  Iran: "Irán",
  Iraq: "Irak",
  "Ivory Coast": "Costa de Marfil",
  Japan: "Japón",
  Jordan: "Jordania",
  "Korea Republic": "Corea del Sur",
  Mexico: "México",
  Morocco: "Marruecos",
  Netherlands: "Países Bajos",
  "New Zealand": "Nueva Zelanda",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguay",
  Portugal: "Portugal",
  Qatar: "Catar",
  "Saudi Arabia": "Arabia Saudí",
  Scotland: "Escocia",
  Senegal: "Senegal",
  "South Africa": "Sudáfrica",
  Spain: "España",
  Sweden: "Suecia",
  Switzerland: "Suiza",
  Tunisia: "Túnez",
  Turkey: "Turquía",
  USA: "EE. UU.",
  Uruguay: "Uruguay",
  Uzbekistan: "Uzbekistán",
};

/**
 * Nombre del equipo en español para mostrar. Si no está traducido (p. ej. un
 * equipo nuevo de eliminatorias), devuelve el nombre original tal cual.
 */
export function esName(team: string): string {
  return TEAM_ES[team] ?? team;
}
