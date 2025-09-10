export type TariffCategory = {
  id: string;
  name: string;
  price: string;
  color: string;
};

export type Client = {
  id: string;
  name: string;
  enseignes: string[];
  categories: TariffCategory[];
};
