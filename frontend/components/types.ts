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

export type ClientCategoryApiPayload = {
  id: number
  name: string
  unitPriceExVat?: string | null
}

export type ClientApiPayload = {
  id: number
  name: string
  categories: ClientCategoryApiPayload[]
}
