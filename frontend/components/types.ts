export type TariffCategory = {
  id: number
  name: string
  price: string
  color: string
}

export type Client = {
  id: number
  name: string
  isActive: boolean
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
  isActive?: boolean
  categories: ClientCategoryApiPayload[]
}
