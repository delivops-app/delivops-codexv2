export type TariffCategory = {
  id: string
  name: string
  price: string
  enseignes: string[]
  color: string
}

export type Client = {
  id: string
  name: string
  categories: TariffCategory[]
}
