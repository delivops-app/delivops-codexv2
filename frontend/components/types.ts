export type TariffCategory = {
  id: number
  name: string
  price: string
  enseignes: string[]
  color: string
}

export type Client = {
  id: number
  name: string
  categories: TariffCategory[]
}
