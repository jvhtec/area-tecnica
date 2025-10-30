/**
 * Utilidades para obtener información de moneda por país
 */

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/**
 * Mapeo de países a sus monedas
 * ISO 3166-1 alpha-2 country codes
 */
const COUNTRY_CURRENCY_MAP: Record<string, CurrencyInfo> = {
  // Europa - Euro
  ES: { code: 'EUR', name: 'Euro', symbol: '€' },
  FR: { code: 'EUR', name: 'Euro', symbol: '€' },
  DE: { code: 'EUR', name: 'Euro', symbol: '€' },
  IT: { code: 'EUR', name: 'Euro', symbol: '€' },
  PT: { code: 'EUR', name: 'Euro', symbol: '€' },
  NL: { code: 'EUR', name: 'Euro', symbol: '€' },
  BE: { code: 'EUR', name: 'Euro', symbol: '€' },
  AT: { code: 'EUR', name: 'Euro', symbol: '€' },
  GR: { code: 'EUR', name: 'Euro', symbol: '€' },
  IE: { code: 'EUR', name: 'Euro', symbol: '€' },
  FI: { code: 'EUR', name: 'Euro', symbol: '€' },

  // Reino Unido
  GB: { code: 'GBP', name: 'British Pound', symbol: '£' },
  UK: { code: 'GBP', name: 'British Pound', symbol: '£' },

  // Suiza
  CH: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },

  // Estados Unidos
  US: { code: 'USD', name: 'US Dollar', symbol: '$' },

  // Otros países europeos
  SE: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  NO: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  DK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  PL: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  CZ: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  HU: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },

  // América Latina
  MX: { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  AR: { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  BR: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  CL: { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  CO: { code: 'COP', name: 'Colombian Peso', symbol: '$' },

  // Asia
  JP: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  CN: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  KR: { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  IN: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },

  // Oceanía
  AU: { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  NZ: { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },

  // Canadá
  CA: { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
};

/**
 * Obtiene la información de moneda para un código de país
 * @param countryCode Código ISO 3166-1 alpha-2 del país (ej: 'ES', 'FR', 'US')
 * @returns Información de la moneda o EUR por defecto
 */
export function getCurrencyByCountry(countryCode: string): CurrencyInfo {
  const upperCode = countryCode.toUpperCase();
  return COUNTRY_CURRENCY_MAP[upperCode] || { code: 'EUR', name: 'Euro', symbol: '€' };
}

/**
 * Obtiene solo el código de moneda para un país
 * @param countryCode Código ISO del país
 * @returns Código de moneda (ej: 'EUR', 'USD', 'GBP')
 */
export function getCurrencyCode(countryCode: string): string {
  return getCurrencyByCountry(countryCode).code;
}

/**
 * Obtiene el símbolo de moneda para un país
 * @param countryCode Código ISO del país
 * @returns Símbolo de moneda (ej: '€', '$', '£')
 */
export function getCurrencySymbol(countryCode: string): string {
  return getCurrencyByCountry(countryCode).symbol;
}

/**
 * Formatea una cantidad con la moneda apropiada
 * @param amount Cantidad
 * @param countryCode Código ISO del país
 * @returns Cantidad formateada con símbolo de moneda
 */
export function formatCurrency(amount: number, countryCode: string): string {
  const currency = getCurrencyByCountry(countryCode);

  // Usar Intl.NumberFormat para formateo local
  try {
    const formatter = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount);
  } catch (error) {
    // Fallback si el código de moneda no es soportado
    return `${currency.symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Lista de todas las monedas disponibles
 */
export function getAllCurrencies(): CurrencyInfo[] {
  const uniqueCurrencies = new Map<string, CurrencyInfo>();

  Object.values(COUNTRY_CURRENCY_MAP).forEach(currency => {
    if (!uniqueCurrencies.has(currency.code)) {
      uniqueCurrencies.set(currency.code, currency);
    }
  });

  return Array.from(uniqueCurrencies.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}
