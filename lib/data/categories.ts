export const CATEGORIES: Record<string, string[]> = {
  "Electronics & Appliances": [
    "Phones & Tablets",
    "TVs & Audio",
    "Computers & Laptops",
    "Home Appliances",
    "Generators & Inverters",
    "Solar Equipment",
  ],
  "Vehicles & Parts": [
    "Cars",
    "Motorcycles & Scooters",
    "Trucks, Vans & Buses",
    "Auto Parts & Tyres",
    "Boats & Marine",
  ],
  "Property & Rentals": [
    "Houses for Rent",
    "Apartments for Rent",
    "Rooms for Rent",
    "Houses for Sale",
    "Land & Lots",
    "Commercial Space",
    "Vacation Rentals",
  ],
  "Furniture & Home": [
    "Living Room",
    "Bedroom",
    "Kitchenware & Appliances",
    "Office Furniture",
    "Home Décor",
    "Garden & Outdoor",
  ],
  "Fashion & Beauty": [
    "Clothing",
    "Shoes",
    "Jewelry & Accessories",
    "Hair & Wigs",
    "Beauty Products",
  ],
  "Agriculture & Farming": [
    "Livestock (Goats, Cows, Pigs)",
    "Poultry",
    "Crops & Ground Provisions",
    "Farm Equipment & Tools",
    "Pets & Pet Supplies",
  ],
  "Baby & Kids": [
    "Baby Gear",
    "Toys & Games",
    "Kids Clothing",
    "School Supplies & Uniforms",
  ],
  "Sports, Music & Hobbies": [
    "Sound Systems & Instruments",
    "Sporting Goods",
    "Bicycles",
    "Collectibles & Books",
  ],
  "Tools & Building Materials": [
    "Hand & Power Tools",
    "Building Materials (Zinc, Cement, Lumber)",
    "Plumbing & Electrical Supplies",
    "Paint & Hardware",
  ],
  Other: ["Miscellaneous"],
};

// Free ad duration is admin-configurable — see AdminSettings.freeAdDays (lib/settings.ts).
export const ARCHIVE_WINDOW_DAYS = 30;
export const MAX_PHOTOS = 10;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB

export const FEE_UNLIMITED_LISTING_JMD = 750; // ~ $5 USD equivalent, set your own price
export const FEE_FEATURED_JMD = 1200; // ~ $8 USD equivalent
export const FEE_RELIST_JMD = 450; // ~ $3 USD equivalent
