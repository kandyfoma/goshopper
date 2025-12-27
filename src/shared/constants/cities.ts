// International Cities Database - Grouped by Country
export interface CityData {
  name: string;
  country: string;
  countryCode: string;
  isPopular?: boolean;
}

export interface CountryData {
  name: string;
  code: string;
  flag: string;
  cities: string[];
  isPopular?: boolean;
}

// Comprehensive country-city database
export const COUNTRIES_CITIES: CountryData[] = [
  // Africa
  {
    name: 'République Démocratique du Congo',
    code: 'CD',
    flag: '🇨🇩',
    isPopular: true,
    cities: [
      'Kinshasa',
      'Lubumbashi',
      'Mbuji-Mayi',
      'Kisangani',
      'Kananga',
      'Bukavu',
      'Goma',
      'Tshikapa',
      'Kolwezi',
      'Likasi',
      'Uvira',
      'Butembo',
      'Beni',
      'Bunia',
      'Isiro',
      'Mbandaka',
      'Kikwit',
      'Matadi',
      'Boma',
      'Bandundu',
      'Gemena',
      'Kabinda',
      'Mwene-Ditu',
      'Kalemie',
      'Kindu',
      'Lisala',
      'Bumba',
      'Inongo',
      'Boende',
      'Lusambo',
      'Ilebo',
      'Kisantu',
      'Mbanza-Ngungu',
      'Kasangulu',
      'Tshela',
    ].sort(),
  },
  {
    name: 'Nigeria',
    code: 'NG',
    flag: '🇳🇬',
    cities: [
      'Lagos',
      'Abuja',
      'Kano',
      'Ibadan',
      'Port Harcourt',
      'Benin City',
      'Kaduna',
      'Enugu',
      'Jos',
      'Ilorin',
      'Aba',
      'Onitsha',
      'Warri',
      'Calabar',
      'Uyo',
      'Maiduguri',
      'Zaria',
      'Abeokuta',
      'Akure',
      'Owerri',
    ].sort(),
  },
  {
    name: 'Kenya',
    code: 'KE',
    flag: '🇰🇪',
    cities: [
      'Nairobi',
      'Mombasa',
      'Kisumu',
      'Nakuru',
      'Eldoret',
      'Thika',
      'Malindi',
      'Kitale',
      'Garissa',
      'Kakamega',
      'Nyeri',
      'Meru',
      'Kisii',
      'Naivasha',
      'Machakos',
    ].sort(),
  },
  {
    name: 'South Africa',
    code: 'ZA',
    flag: '🇿🇦',
    cities: [
      'Johannesburg',
      'Cape Town',
      'Durban',
      'Pretoria',
      'Port Elizabeth',
      'Bloemfontein',
      'East London',
      'Polokwane',
      'Pietermaritzburg',
      'Nelspruit',
      'Kimberley',
      'Rustenburg',
      'George',
      'Upington',
    ].sort(),
  },
  {
    name: 'Ghana',
    code: 'GH',
    flag: '🇬🇭',
    cities: [
      'Accra',
      'Kumasi',
      'Tamale',
      'Sekondi-Takoradi',
      'Cape Coast',
      'Sunyani',
      'Koforidua',
      'Ho',
      'Tema',
      'Wa',
    ].sort(),
  },
  {
    name: 'Tanzania',
    code: 'TZ',
    flag: '🇹🇿',
    cities: [
      'Dar es Salaam',
      'Dodoma',
      'Mwanza',
      'Arusha',
      'Mbeya',
      'Morogoro',
      'Tanga',
      'Zanzibar City',
      'Kigoma',
      'Moshi',
    ].sort(),
  },
  {
    name: 'Uganda',
    code: 'UG',
    flag: '🇺🇬',
    cities: [
      'Kampala',
      'Gulu',
      'Lira',
      'Mbarara',
      'Jinja',
      'Mbale',
      'Mukono',
      'Masaka',
      'Entebbe',
      'Kasese',
    ].sort(),
  },
  {
    name: 'Ethiopia',
    code: 'ET',
    flag: '🇪🇹',
    cities: [
      'Addis Ababa',
      'Dire Dawa',
      'Mekele',
      'Gondar',
      'Bahir Dar',
      'Awassa',
      'Jimma',
      'Harar',
      'Adama',
      'Dessie',
    ].sort(),
  },
  {
    name: 'Cameroon',
    code: 'CM',
    flag: '🇨🇲',
    isPopular: true,
    cities: [
      'Douala',
      'Yaoundé',
      'Garoua',
      'Bamenda',
      'Bafoussam',
      'Maroua',
      'Ngaoundéré',
      'Bertoua',
      'Kribi',
      'Limbe',
    ].sort(),
  },
  {
    name: 'Côte d\'Ivoire',
    code: 'CI',
    flag: '🇨🇮',
    cities: [
      'Abidjan',
      'Yamoussoukro',
      'Bouaké',
      'Daloa',
      'San-Pédro',
      'Korhogo',
      'Man',
      'Gagnoa',
      'Divo',
      'Abengourou',
    ].sort(),
  },
  {
    name: 'Senegal',
    code: 'SN',
    flag: '🇸🇳',
    cities: [
      'Dakar',
      'Touba',
      'Thiès',
      'Kaolack',
      'Saint-Louis',
      'Ziguinchor',
      'Mbour',
      'Rufisque',
      'Louga',
      'Diourbel',
    ].sort(),
  },
  
  // Europe
  {
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    cities: [
      'Paris',
      'Marseille',
      'Lyon',
      'Toulouse',
      'Nice',
      'Nantes',
      'Strasbourg',
      'Montpellier',
      'Bordeaux',
      'Lille',
      'Rennes',
      'Reims',
      'Le Havre',
      'Saint-Étienne',
      'Toulon',
    ].sort(),
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    cities: [
      'London',
      'Birmingham',
      'Manchester',
      'Leeds',
      'Glasgow',
      'Liverpool',
      'Newcastle',
      'Sheffield',
      'Bristol',
      'Edinburgh',
      'Leicester',
      'Belfast',
      'Cardiff',
      'Nottingham',
      'Southampton',
    ].sort(),
  },
  {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    cities: [
      'Berlin',
      'Hamburg',
      'Munich',
      'Cologne',
      'Frankfurt',
      'Stuttgart',
      'Düsseldorf',
      'Dortmund',
      'Essen',
      'Leipzig',
      'Bremen',
      'Dresden',
      'Hanover',
      'Nuremberg',
      'Duisburg',
    ].sort(),
  },
  {
    name: 'Belgium',
    code: 'BE',
    flag: '🇧🇪',
    cities: [
      'Brussels',
      'Antwerp',
      'Ghent',
      'Charleroi',
      'Liège',
      'Bruges',
      'Namur',
      'Leuven',
      'Mons',
      'Mechelen',
    ].sort(),
  },

  // North America
  {
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    cities: [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Phoenix',
      'Philadelphia',
      'San Antonio',
      'San Diego',
      'Dallas',
      'San Jose',
      'Austin',
      'Jacksonville',
      'Fort Worth',
      'Columbus',
      'Charlotte',
      'San Francisco',
      'Seattle',
      'Denver',
      'Boston',
      'Miami',
    ].sort(),
  },
  {
    name: 'Canada',
    code: 'CA',
    flag: '🇨🇦',
    cities: [
      'Toronto',
      'Montreal',
      'Vancouver',
      'Calgary',
      'Edmonton',
      'Ottawa',
      'Winnipeg',
      'Quebec City',
      'Hamilton',
      'Kitchener',
      'London',
      'Victoria',
      'Halifax',
      'Oshawa',
      'Windsor',
    ].sort(),
  },

  // Asia
  {
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    cities: [
      'Mumbai',
      'Delhi',
      'Bangalore',
      'Hyderabad',
      'Chennai',
      'Kolkata',
      'Pune',
      'Ahmedabad',
      'Jaipur',
      'Surat',
      'Lucknow',
      'Kanpur',
      'Nagpur',
      'Indore',
      'Thane',
    ].sort(),
  },
  {
    name: 'China',
    code: 'CN',
    flag: '🇨🇳',
    cities: [
      'Beijing',
      'Shanghai',
      'Guangzhou',
      'Shenzhen',
      'Chengdu',
      'Chongqing',
      'Tianjin',
      'Wuhan',
      'Hangzhou',
      'Nanjing',
      'Xi\'an',
      'Suzhou',
      'Qingdao',
      'Zhengzhou',
      'Shenyang',
    ].sort(),
  },
  {
    name: 'Japan',
    code: 'JP',
    flag: '🇯🇵',
    cities: [
      'Tokyo',
      'Osaka',
      'Yokohama',
      'Nagoya',
      'Sapporo',
      'Fukuoka',
      'Kobe',
      'Kyoto',
      'Kawasaki',
      'Saitama',
      'Hiroshima',
      'Sendai',
      'Kitakyushu',
      'Chiba',
      'Sakai',
    ].sort(),
  },

  // Middle East
  {
    name: 'United Arab Emirates',
    code: 'AE',
    flag: '🇦🇪',
    cities: [
      'Dubai',
      'Abu Dhabi',
      'Sharjah',
      'Al Ain',
      'Ajman',
      'Ras Al Khaimah',
      'Fujairah',
      'Umm Al Quwain',
    ].sort(),
  },

  // South America
  {
    name: 'Brazil',
    code: 'BR',
    flag: '🇧🇷',
    cities: [
      'São Paulo',
      'Rio de Janeiro',
      'Brasília',
      'Salvador',
      'Fortaleza',
      'Belo Horizonte',
      'Manaus',
      'Curitiba',
      'Recife',
      'Porto Alegre',
    ].sort(),
  },
].sort((a, b) => {
  // Popular countries first
  if (a.isPopular && !b.isPopular) return -1;
  if (!a.isPopular && b.isPopular) return 1;
  return a.name.localeCompare(b.name);
});

// Popular cities for quick access - African cities near DRC
export const POPULAR_CITIES = [
  // RDC - 4 cities (first in line)
  'Kinshasa',
  'Lubumbashi',
  'Goma',
  'Bukavu',
  // Cameroon - 4 cities
  'Douala',
  'Yaoundé',
  'Garoua',
  'Bamenda',
];

// Helper function to search cities globally
export function searchCities(query: string): CityData[] {
  if (!query.trim()) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const results: CityData[] = [];

  COUNTRIES_CITIES.forEach(country => {
    country.cities.forEach(city => {
      if (city.toLowerCase().includes(normalizedQuery)) {
        results.push({
          name: city,
          country: country.name,
          countryCode: country.code,
          isPopular: POPULAR_CITIES.includes(city),
        });
      }
    });
  });

  return results.sort((a, b) => {
    // Popular cities first
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return a.name.localeCompare(b.name);
  });
}

// Helper function to get country by code
export function getCountryByCode(code: string): CountryData | undefined {
  return COUNTRIES_CITIES.find(c => c.code === code);
}

// Helper function to find city's country
export function findCityCountry(cityName: string): CountryData | undefined {
  return COUNTRIES_CITIES.find(country =>
    country.cities.some(city => city.toLowerCase() === cityName.toLowerCase())
  );
}
