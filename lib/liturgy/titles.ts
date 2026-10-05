import { FIXED_FEASTS } from "./data/fixed-feasts";

/**
 * English and Tamil names for day codes. English follows Roman-Calendar's titles; Tamil follows
 * the Tamil Lectionary (Tamil-Catholic-Lectionary). Fixed feasts use their own names.
 */

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TA_DAYS = ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"];

const SPECIAL: Record<string, { en: string; ta: string }> = {
  "CW02-0Sun": { en: "Second Sunday after Christmas", ta: "கிறிஸ்து பிறப்பு விழாவுக்குப் பின் 2ஆம் ஞாயிறு" },
  "CW03-Epiphany": { en: "The Epiphany of the Lord", ta: "ஆண்டவரின் திருக்காட்சி" },
  "CW04-Baptism": { en: "The Baptism of the Lord", ta: "ஆண்டவரின் திருமுழுக்கு" },
  "CW01-HolyFamily": {
    en: "The Holy Family of Jesus, Mary and Joseph",
    ta: "இயேசு, மரியா, யோசேப்பின் திருக்குடும்பம்",
  },
  "LW00-3Wed": { en: "Ash Wednesday", ta: "திருநீற்றுப் புதன்" },
  "LW06-0Sun": { en: "Palm Sunday of the Passion of the Lord", ta: "ஆண்டவருடைய திருப்பாடுகளின் குருத்து ஞாயிறு" },
  "LW06-4Thu": { en: "Thursday of Holy Week (Holy Thursday)", ta: "ஆண்டவரின் இராவுணவுத் திருப்பலி" },
  "LW06-5Fri": { en: "Friday of the Passion of the Lord (Good Friday)", ta: "திருப்பாடுகளின் வெள்ளி" },
  "LW06-6Sat": { en: "Holy Saturday", ta: "பாஸ்கா திருவிழிப்பு" },
  "EW01-0Sun": { en: "Easter Sunday of the Resurrection of the Lord", ta: "ஆண்டவருடைய உயிர்ப்பின் பாஸ்கா ஞாயிறு" },
  "EW07-Ascension": { en: "The Ascension of the Lord", ta: "ஆண்டவரின் விண்ணேற்றம்" },
  "EW08-Pentecost": { en: "Pentecost Sunday", ta: "தூய ஆவி ஞாயிறு" },
  "OW00-Trinity": { en: "The Most Holy Trinity", ta: "மூவொரு கடவுள்" },
  "OW00-CorpusChristi": { en: "The Most Holy Body and Blood of Christ", ta: "கிறிஸ்துவின் திருவுடல், திருஇரத்தம்" },
  "OW00-SacredHeart": { en: "The Most Sacred Heart of Jesus", ta: "இயேசுவின் திருஇதயம்" },
  "OW00-ImmaculateHeart": { en: "Immaculate Heart of the Blessed Virgin Mary", ta: "தூய கன்னி மரியாவின் மாசற்ற இதயம்" },
  "OW00-MaryMotherofChurch": { en: "Mary, Mother of the Church", ta: "தூய கன்னி மரியா, திரு அவையின் அன்னை" },
  "OW34-0Sun": { en: "Our Lord Jesus Christ, King of the Universe", ta: "இயேசு கிறிஸ்து அனைத்துலக அரசர்" },
  "Mem-Mary-Sat": {
    en: "Saturday Memorial of the Blessed Virgin Mary",
    ta: "சனிக்கிழமையில் தூய கன்னி மரியாவின் நினைவு",
  },
  "All Souls": {
    en: "The Commemoration of All the Faithful Departed (All Souls)",
    ta: "இறந்த விசுவாசிகள் அனைவரின் நினைவு",
  },
};

const FEAST_NAMES = new Map(FIXED_FEASTS.map((f) => [f.code, f.nameTa]));

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

const taWeek = (n: number) => (n === 1 ? "முதல்" : `${n}ஆம்`);

export function dayTitle(code: string, epiphanyOnSunday: boolean): { en: string; ta: string } {
  const special = SPECIAL[code];
  if (special) return special;
  const feastTa = FEAST_NAMES.get(code);
  if (feastTa) return { en: code.replace(/^IN /, ""), ta: feastTa };

  const prefix = code.slice(0, 2);
  const week = Number(code.slice(2, 4));
  const wd = Number(code.at(-4));
  const tail = code.split("-")[1] ?? "";

  switch (prefix) {
    case "AW":
      if (tail.startsWith("Dec")) {
        const d = tail.slice(3);
        return { en: `Advent Weekday: December ${d}`, ta: `திருவருகைக் கால வார நாள்கள் - டிசம்பர் ${d}` };
      }
      return {
        en: `${EN_DAYS[wd]} of the ${ordinal(week)} Week of Advent`,
        ta: `திருவருகைக் காலம் ${taWeek(week)} வாரம் - ${TA_DAYS[wd]}`,
      };
    case "CW":
      if (week === 1) {
        const d = Number(tail.slice(3));
        return {
          en: `${ordinal(d - 24)} Day in the Octave of Christmas`,
          ta: `கிறிஸ்து பிறப்பின் எண்கிழமையில் ${d - 24}ஆம் நாள் - டிசம்பர் ${d}`,
        };
      }
      if (week === 2) {
        const d = tail.slice(3);
        return { en: `Christmas Weekday: January ${d}`, ta: `சனவரி ${d}` };
      }
      if (week === 3) {
        const n = Number(tail.replace("Day", ""));
        return epiphanyOnSunday
          ? { en: `${EN_DAYS[n]} after Epiphany`, ta: `திருக்காட்சி விழாவுக்குப் பின் ${TA_DAYS[n]}` }
          : { en: `Christmas Weekday: January ${6 + n}`, ta: `சனவரி ${6 + n}` };
      }
      break;
    case "LW":
      if (week === 0)
        return { en: `${EN_DAYS[wd]} after Ash Wednesday`, ta: `திருநீற்றுப் புதனுக்குப் பின் வரும் ${TA_DAYS[wd]}` };
      if (week === 6) return { en: `${EN_DAYS[wd]} of Holy Week`, ta: `புனித வாரம் - ${TA_DAYS[wd]}` };
      return {
        en: `${EN_DAYS[wd]} of the ${ordinal(week)} Week of Lent`,
        ta: `தவக்காலம் ${taWeek(week)} வாரம் - ${TA_DAYS[wd]}`,
      };
    case "EW":
      if (week === 1) return { en: `${EN_DAYS[wd]} in the Octave of Easter`, ta: `பாஸ்கா எண்கிழமை - ${TA_DAYS[wd]}` };
      return {
        en: `${EN_DAYS[wd]} of the ${ordinal(week)} Week of Easter`,
        ta: `பாஸ்கா காலம் ${taWeek(week)} வாரம் - ${TA_DAYS[wd]}`,
      };
    case "OW":
      return {
        en: `${EN_DAYS[wd]} of the ${ordinal(week)} Week in Ordinary Time`,
        ta: `பொதுக்காலம் ${taWeek(week)} வாரம் - ${TA_DAYS[wd]}`,
      };
  }
  return { en: code, ta: code };
}
