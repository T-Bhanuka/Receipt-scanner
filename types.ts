
export enum Category {
  Food = "Food",
  Furniture = "Furniture",
  Stationery = "Stationery",
  Medicine = "Medicine",
  BabyAccessories = "Baby Accessories",
  MobileAccessories = "Mobile Accessories",
  PetItems = "Pet Items",
  Other = "Other"
}

export interface ReceiptItem {
  name: string;
  price: number;
  category: Category;
}

export interface Receipt {
  id: string;
  storeName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  items: ReceiptItem[];
  total: number;
  category: Category; // Dominant category
  timestamp: number;
  galleryImageId?: string; // Link to the original photo
}

export interface GalleryImage {
  id: string;
  base64: string;
  timestamp: number;
  isProcessed: boolean;
  linkedReceiptId?: string;
}

export interface UserBudget {
  monthlyLimit: number;
  spent: number;
}
